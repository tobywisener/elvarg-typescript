import type { CacheInfo } from "./CacheInfo";

export type CacheDecodeProfile = Readonly<{
    clientScriptLongCounts: boolean;
    if3ModelIdBytes: 2 | 4;
}>;

export const DEFAULT_CACHE_DECODE_PROFILE: CacheDecodeProfile = Object.freeze({
    clientScriptLongCounts: true,
    if3ModelIdBytes: 4,
});

const CACHE_DECODE_OVERRIDES: Readonly<Record<string, Partial<CacheDecodeProfile>>> = {
    "oldschool:236": {
        clientScriptLongCounts: false,
        if3ModelIdBytes: 2,
    },
};

export function resolveCacheDecodeProfile(
    info?: Pick<CacheInfo, "game" | "revision">,
): CacheDecodeProfile {
    if (!info) return DEFAULT_CACHE_DECODE_PROFILE;
    const override = CACHE_DECODE_OVERRIDES[`${info.game}:${info.revision}`];
    return override
        ? Object.freeze({ ...DEFAULT_CACHE_DECODE_PROFILE, ...override })
        : DEFAULT_CACHE_DECODE_PROFILE;
}
