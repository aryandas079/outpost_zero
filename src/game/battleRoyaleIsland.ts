/**
 * Compatibility facade re-exporting modularized 10 km² Battle Royale Island subsystems.
 */

export * from '../world/Terrain';
export * from '../world/MapGenerator';
export * from '../entities/Aircraft';
export * from '../entities/Parachute';
export type { IslandPoiSpec, PoiTheme, IslandRoadSpec, RoadKind } from '../world/Terrain';
export type { IslandArenaData } from '../world/MapGenerator';
export type { TransportAirplaneRig } from '../entities/Aircraft';
