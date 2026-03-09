const MAC_PLATFORM_PATTERN = /mac|iphone|ipad|ipod/i;

const getNavigatorPlatform = (): string => {
    if (typeof navigator === "undefined") return "";
    return `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
};

export const isMacHost = MAC_PLATFORM_PATTERN.test(getNavigatorPlatform());
