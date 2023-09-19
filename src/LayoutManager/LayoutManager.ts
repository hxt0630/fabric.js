import type { TModificationEvents } from '../EventTypeDefs';
import { Point } from '../Point';
import { CENTER, iMatrix } from '../constants';
import type { Group } from '../shapes/Group';
import type { FabricObject } from '../shapes/Object/FabricObject';
import { invertTransform } from '../util/misc/matrix';
import { resolveOrigin } from '../util/misc/resolveOrigin';
import { FitContentLayout } from './LayoutStrategies/FitContentLayout';
import type { LayoutStrategy } from './LayoutStrategies/LayoutStrategy';
import type { LayoutContext, LayoutResult, StrictLayoutContext } from './types';

export class LayoutManager {
  private _firstLayoutDone = false;
  private _prevLayoutStrategy?: LayoutStrategy;
  private _subscriptions: Map<FabricObject, VoidFunction[]>;

  strategy: LayoutStrategy;

  constructor(strategy: LayoutStrategy = new FitContentLayout()) {
    this.strategy = strategy;
    this._subscriptions = new Map();
  }

  performLayout(context: LayoutContext) {
    if (!this._firstLayoutDone && context.type !== 'initialization') {
      //  reject layout requests before initialization layout
      return;
    }

    const strictContext: StrictLayoutContext = {
      bubbles: true,
      strategy: this.strategy,
      ...context,
      prevStrategy: this._prevLayoutStrategy,
      stopPropagation() {
        this.bubbles = false;
      },
    };

    this.onBeforeLayout(strictContext);

    const layoutResult = this.getLayoutResult(strictContext);
    layoutResult && this.commitLayout(strictContext, layoutResult);

    this._firstLayoutDone = true;
    this.onAfterLayout(strictContext, layoutResult);
    this._prevLayoutStrategy = strictContext.strategy;
  }

  /**
   * subscribe to object layout triggers
   */
  protected subscribe(context: StrictLayoutContext, object: FabricObject) {
    const { target } = context;
    this.unsubscribe(context, object);
    const disposers = [
      object.on('modified', (e) =>
        this.performLayout({
          trigger: 'modified',
          e: { ...e, target: object },
          type: 'object_modified',
          target,
        })
      ),
      ...(
        [
          'moving',
          'resizing',
          'rotating',
          'scaling',
          'skewing',
          'changed',
        ] as TModificationEvents[]
      ).map((key) =>
        object.on(key, (e) =>
          this.performLayout({
            trigger: key,
            e: { ...e, target: object },
            type: 'object_modifying',
            target,
          })
        )
      ),
    ];
    this._subscriptions.set(object, disposers);
  }

  /**
   * unsubscribe object layout triggers
   */
  protected unsubscribe(context: StrictLayoutContext, object: FabricObject) {
    (this._subscriptions.get(object) || []).forEach((d) => d());
    this._subscriptions.delete(object);
  }

  protected onBeforeLayout(context: StrictLayoutContext) {
    const { target } = context;

    // handle layout triggers subscription
    if (context.type === 'initialization' || context.type === 'added') {
      context.targets.forEach((object) => this.subscribe(context, object));
    } else if (context.type === 'removed') {
      context.targets.forEach((object) => this.unsubscribe(context, object));
    }

    //  fire layout event (event will fire only for layouts after initialization layout)
    target.fire('layout:before', {
      context,
    });

    if (context.type === 'imperative' && context.deep) {
      const { strategy: _, ...tricklingContext } = context;
      // traverse the tree
      target.forEachObject((object) => {
        (object as Group).layoutManager?.performLayout({
          ...tricklingContext,
          bubbles: false,
          target: object as Group,
        });
      });
    }
  }

  protected getLayoutResult(
    context: StrictLayoutContext
  ): Required<LayoutResult> | undefined {
    const { target } = context;
    const prevCenter =
      context.type === 'initialization'
        ? new Point()
        : target.getRelativeCenterPoint();
    const result = context.strategy.calcLayoutResult(
      context,
      target.getObjects()
    );
    if (!result) {
      return;
    }
    const {
      center: nextCenter,
      correction = new Point(),
      relativeCorrection = new Point(),
    } = result;
    const offset =
      context.type === 'initialization' && context.objectsRelativeToGroup
        ? new Point()
        : prevCenter
            .subtract(nextCenter)
            .add(correction)
            .transform(
              // in `initialization` we do not account for target's transformation matrix
              context.type === 'initialization'
                ? iMatrix
                : invertTransform(target.calcOwnMatrix()),
              true
            )
            .add(relativeCorrection);

    return {
      result,
      prevCenter,
      nextCenter,
      offset,
    };
  }

  protected commitLayout(
    context: StrictLayoutContext,
    layoutResult: Required<LayoutResult>
  ) {
    const { target } = context;
    const {
      result: { size },
      nextCenter,
    } = layoutResult;
    // set dimensions
    target.set({ width: size.x, height: size.y });
    // layout descendants
    this.layoutObjects(context, layoutResult);
    //  set position
    // in `initialization` we do not account for target's transformation matrix
    if (context.type === 'initialization') {
      // TODO: what about strokeWidth?
      target.set({
        left:
          context.x ?? nextCenter.x + size.x * resolveOrigin(target.originX),
        top: context.y ?? nextCenter.y + size.y * resolveOrigin(target.originY),
      });
    } else {
      target.setPositionByOrigin(nextCenter, CENTER, CENTER);
      // invalidate
      target.setCoords();
      target.set({ dirty: true });
    }
  }

  protected layoutObjects(
    context: StrictLayoutContext,
    layoutResult: Required<LayoutResult>
  ) {
    const { target } = context;
    //  adjust objects to account for new center
    (context.type !== 'initialization' || !context.objectsRelativeToGroup) &&
      target.forEachObject((object) => {
        object.group === target &&
          this.layoutObject(context, layoutResult, object);
      });
    // adjust clip path to account for new center
    context.strategy.shouldLayoutClipPath(context) &&
      this.layoutObject(context, layoutResult, target.clipPath as FabricObject);
  }

  /**
   * @param {FabricObject} object
   * @param {Point} offset
   */
  protected layoutObject(
    context: StrictLayoutContext,
    { offset }: Required<LayoutResult>,
    object: FabricObject
  ) {
    object.set({
      left: object.left + offset.x,
      top: object.top + offset.y,
    });
  }

  protected onAfterLayout(
    context: StrictLayoutContext,
    layoutResult?: LayoutResult
  ) {
    const {
      target,
      strategy,
      bubbles,
      prevStrategy: _,
      ...bubblingContext
    } = context;

    if (strategy.shouldResetTransform(context)) {
      Object.assign(target, {
        left: 0,
        top: 0,
        angle: 0,
        scaleX: 1,
        scaleY: 1,
        skewX: 0,
        skewY: 0,
        flipX: false,
        flipY: false,
      });
    }

    //  fire layout event (event will fire only for layouts after initialization layout)
    target.fire('layout:after', {
      context,
      result: layoutResult,
    });

    //  bubble
    const parent = target.group;
    if (bubbles && parent?.layoutManager) {
      //  add target to context#path
      (bubblingContext.path || (bubblingContext.path = [])).push(target);
      //  all parents should invalidate their layout
      parent.layoutManager.performLayout({
        ...bubblingContext,
        target: parent,
      });
    }
  }

  dispose() {
    this._subscriptions.forEach((disposers) => disposers.forEach((d) => d()));
    this._subscriptions.clear();
  }

  toJSON() {
    return {
      strategy: (this.strategy.constructor as typeof LayoutStrategy).type,
    };
  }
}
