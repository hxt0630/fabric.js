import type {
  BasicTransformEvent,
  ModifiedEvent,
  TModificationEvents,
} from '../EventTypeDefs';
import type { Point } from '../Point';
import type { Group } from '../shapes/Group';
import type { ITextEvents } from '../shapes/IText/ITextBehavior';
import type { FabricObject } from '../shapes/Object/FabricObject';
import type { LayoutStrategy } from './LayoutStrategies/LayoutStrategy';

export type LayoutTrigger =
  | 'initialization'
  | 'object_modifying'
  | 'object_modified'
  | 'added'
  | 'removed'
  | 'imperative';

export type LayoutStrategyResult = {
  /**
   * new center point as measured by the **containing** plane (same as `left` with `originX` set to `center`)
   */
  center: Point;

  /**
   * correction vector to translate objects by, measured in the same plane as `center`
   *
   * Since objects are measured relative to the group's center, once the group's size changes we must apply a correction to
   * the objects' positions so that they relate to the new center.
   * In other words, this value makes it possible to layout objects relative to the tl corner, for instance, but not only.
   */
  correction?: Point;

  /**
   * correction vector to translate objects by as measured by the plane
   */
  relativeCorrection?: Point;

  /**
   * new width and height of the layout target
   */
  size: Point;
};

export type LayoutResult = {
  result?: LayoutStrategyResult;
  prevCenter: Point;
  nextCenter: Point;
  /**
   * The vector used to offset objects by, as measured by the plane
   */
  offset: Point;
};

type ImperativeLayoutCommonOptions = {
  overrides?: LayoutStrategyResult;
  bubbles?: boolean;
  deep?: boolean;
};

export type ImperativeLayoutOptions = ImperativeLayoutCommonOptions & {
  strategy?: LayoutStrategy;
};

export type CommonLayoutContext = {
  target: Group;
  strategy?: LayoutStrategy;
  type: LayoutTrigger;
  /**
   * array of objects starting from the object that triggered the call to the current one
   */
  path?: Group[];
};

export type InitializationLayoutContext = CommonLayoutContext & {
  type: 'initialization';
  objectsRelativeToGroup?: boolean;
  targets: FabricObject[];
  x?: number;
  y?: number;
};

export type CollectionChangeLayoutContext = CommonLayoutContext & {
  type: 'added' | 'removed';
  targets: FabricObject[];
};

export type ObjectModifiedLayoutContext = CommonLayoutContext & {
  type: 'object_modified';
  trigger: 'modified';
  e: ModifiedEvent;
};

export type ObjectModifyingLayoutContext =
  | CommonLayoutContext & {
      type: 'object_modifying';
    } & (
        | {
            trigger: TModificationEvents;
            e: BasicTransformEvent & { target: FabricObject };
          }
        | {
            trigger: 'changed';
            e: ITextEvents['changed'] & { target: FabricObject };
          }
      );

export type ImperativeLayoutContext = CommonLayoutContext &
  ImperativeLayoutCommonOptions & {
    type: 'imperative';
  };

export type LayoutContext =
  | InitializationLayoutContext
  | CollectionChangeLayoutContext
  | ObjectModifiedLayoutContext
  | ObjectModifyingLayoutContext
  | ImperativeLayoutContext;

export type StrictLayoutContext = LayoutContext & {
  strategy: LayoutStrategy;
  prevStrategy?: LayoutStrategy;
  bubbles: boolean;
  stopPropagation(): void;
};

export type LayoutBeforeEvent = {
  context: StrictLayoutContext;
};

export type LayoutAfterEvent = {
  context: StrictLayoutContext;
  /**
   * will be undefined if layout was skipped
   */
  result?: LayoutResult;
};