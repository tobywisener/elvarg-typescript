import { Location } from "../../model/Location";
import { Mobile } from "../../entity/impl/Mobile";
import { WORLD_ZONE_BOUNDARIES } from "../../definition/WorldDefinition";

export class Wilderness {
    public static isInLocation(location: Location | null | undefined): boolean {
        if (!location) {
            return false;
        }
        return !WORLD_ZONE_BOUNDARIES.safe.some((boundary) => boundary.inside(location))
            && WORLD_ZONE_BOUNDARIES.pvp.some((boundary) => boundary.inside(location));
    }

    public static isIn(character: Mobile | null | undefined): boolean {
        return Wilderness.isInLocation(character?.getLocation?.());
    }

    public static levelForY(y: number): number {
        return Math.floor(((y > 6400 ? y - 6400 : y) - 3520) / 8) + 1;
    }

    public static isMulti(x: number, y: number): boolean {
        const location = new Location(x, y, 0);
        return WORLD_ZONE_BOUNDARIES["multi-combat"].some((boundary) => boundary.inside(location));
    }

    public static intersectsArea(minX: number, maxX: number, minY: number, maxY: number, z: number): boolean {
        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
            return false;
        }
        if (!Number.isFinite(z)) {
            return false;
        }
        return WORLD_ZONE_BOUNDARIES.pvp.some((boundary) => {
            const boundaryZ = boundary.height ?? 0;
            const boundaryMinX = boundary.getX();
            const boundaryMaxX = boundary.getX2();
            const boundaryMinY = boundary.getY();
            const boundaryMaxY = boundary.getY2();
            return (
                boundaryZ === z &&
                boundaryMinX <= maxX &&
                boundaryMaxX >= minX &&
                boundaryMinY <= maxY &&
                boundaryMaxY >= minY
            );
        });
    }
}
