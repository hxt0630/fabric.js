import { twoMathPi } from '../constants';
import { TOCoord } from '../shapes/Object/InteractiveObject';
import type { FabricObject } from '../shapes/Object/Object';
import { degreesToRadians } from '../util/misc/radiansDegreesConversion';
import type { Control } from './Control';

export type ControlRenderingStyleOverride = Partial<
  Pick<
    FabricObject,
    | 'cornerStyle'
    | 'cornerSize'
    | 'cornerColor'
    | 'cornerStrokeColor'
    | 'cornerDashArray'
    | 'transparentCorners'
    | 'borderColor'
    | 'borderDashArray'
  >
>;

export type ControlRenderer = (
  ctx: CanvasRenderingContext2D,
  position: TOCoord,
  styleOverride: ControlRenderingStyleOverride,
  fabricObject: FabricObject
) => void;

/**
 * Render a round control, as per fabric features.
 * This function is written to respect object properties like transparentCorners, cornerSize
 * cornerColor, cornerStrokeColor
 * plus the addition of offsetY and offsetX.
 * @param {CanvasRenderingContext2D} ctx context to render on
 * @param {TOCoord} position coordinate where the control center should be
 * @param {Object} styleOverride override for FabricObject controls style
 * @param {FabricObject} fabricObject the fabric object for which we are rendering controls
 */
export function renderCircleControl(
  this: Control,
  ctx: CanvasRenderingContext2D,
  coordinate: TOCoord,
  styleOverride: ControlRenderingStyleOverride,
  fabricObject: FabricObject
) {
  styleOverride = styleOverride || {};
  const xSize =
      this.sizeX || styleOverride.cornerSize || fabricObject.cornerSize,
    ySize = this.sizeY || styleOverride.cornerSize || fabricObject.cornerSize,
    transparentCorners =
      typeof styleOverride.transparentCorners !== 'undefined'
        ? styleOverride.transparentCorners
        : fabricObject.transparentCorners,
    methodName = transparentCorners ? 'stroke' : 'fill',
    stroke =
      !transparentCorners &&
      (styleOverride.cornerStrokeColor || fabricObject.cornerStrokeColor);
  let { x, y } = coordinate,
    size;
  ctx.save();
  ctx.fillStyle = styleOverride.cornerColor || fabricObject.cornerColor || '';
  ctx.strokeStyle =
    styleOverride.cornerStrokeColor || fabricObject.cornerStrokeColor || '';
  // TODO: use proper ellipse code.
  if (xSize > ySize) {
    size = xSize;
    ctx.scale(1.0, ySize / xSize);
    y = (coordinate.y * xSize) / ySize;
  } else if (ySize > xSize) {
    size = ySize;
    ctx.scale(xSize / ySize, 1.0);
    x = (coordinate.x * ySize) / xSize;
  } else {
    size = xSize;
  }
  // this is still wrong
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, twoMathPi, false);
  ctx[methodName]();
  if (stroke) {
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Render a square control, as per fabric features.
 * This function is written to respect object properties like transparentCorners, cornerSize
 * cornerColor, cornerStrokeColor
 * plus the addition of offsetY and offsetX.
 * @param {CanvasRenderingContext2D} ctx context to render on
 * @param {TOCoord} position coordinate where the control center should be
 * @param {Object} styleOverride override for FabricObject controls style
 * @param {FabricObject} fabricObject the fabric object for which we are rendering controls
 */
export function renderSquareControl(
  this: Control,
  ctx: CanvasRenderingContext2D,
  position: TOCoord,
  styleOverride: ControlRenderingStyleOverride,
  fabricObject: FabricObject
) {
  styleOverride = styleOverride || {};
  const xSize =
      this.sizeX || styleOverride.cornerSize || fabricObject.cornerSize,
    ySize = this.sizeY || styleOverride.cornerSize || fabricObject.cornerSize,
    transparentCorners =
      typeof styleOverride.transparentCorners !== 'undefined'
        ? styleOverride.transparentCorners
        : fabricObject.transparentCorners,
    methodName = transparentCorners ? 'stroke' : 'fill',
    stroke =
      !transparentCorners &&
      (styleOverride.cornerStrokeColor || fabricObject.cornerStrokeColor),
    xSizeBy2 = xSize / 2,
    ySizeBy2 = ySize / 2;
  ctx.save();
  ctx.fillStyle = styleOverride.cornerColor || fabricObject.cornerColor || '';
  ctx.strokeStyle =
    styleOverride.cornerStrokeColor || fabricObject.cornerStrokeColor || '';
  // this is still wrong
  ctx.lineWidth = 1;
  ctx.translate(position.x, position.y);
  //  angle is relative to canvas plane
  const angle = fabricObject.getTotalAngle();
  ctx.rotate(degreesToRadians(angle));
  // this does not work, and fixed with ( && ) does not make sense.
  // to have real transparent corners we need the controls on upperCanvas
  // transparentCorners || ctx.clearRect(-xSizeBy2, -ySizeBy2, xSize, ySize);
  ctx[`${methodName}Rect`](-xSizeBy2, -ySizeBy2, xSize, ySize);
  if (stroke) {
    ctx.strokeRect(-xSizeBy2, -ySizeBy2, xSize, ySize);
  }
  ctx.restore();
}