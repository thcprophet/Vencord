
import * as DataStore from "@api/DataStore";
import { RestAPI } from "@webpack/common";

const CACHE_KEY = "AutoVcKick_UserCache_v1";

const USER_TTL = 7 * 24 * 60 * 60 * 1000;
const MEMBER_TTL = 3 * 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

export interface CachedUser {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
}

export interface CachedMember {
    nick?: string | null;
    avatar?: string | null;
}

interface PersistedCache {
    users: [string, CacheEntry<CachedUser>][];
    members: [string, CacheEntry<CachedMember>][];
}

const userCache = new Map<string, CacheEntry<CachedUser>>();
const memberCache = new Map<string, CacheEntry<CachedMember>>();

const userRequests = new Map<string, Promise<CachedUser | null>>();
const memberRequests = new Map<string, Promise<CachedMember | null>>();

let loadPromise: Promise<void> | null = null;
let saveQueue = Promise.resolve();

async function loadCache() {
    if (!loadPromise) {
        loadPromise = (async () => {
            try {
                const stored = await DataStore.get<PersistedCache>(CACHE_KEY);

                if (!stored || typeof stored !== "object") return;

                if (Array.isArray(stored.users)) {
                    for (const [id, entry] of stored.users) {
                        if (
                            typeof id === "string" &&
                            entry?.value &&
                            typeof entry.expiresAt === "number"
                        ) {
                            userCache.set(id, entry);
                        }
                    }
                }

                if (Array.isArray(stored.members)) {
                    for (const [key, entry] of stored.members) {
                        if (
                            typeof key === "string" &&
                            entry?.value &&
                            typeof entry.expiresAt === "number"
                        ) {
                            memberCache.set(key, entry);
                        }
                    }
                }
            } catch (error) {
                console.error("[AutoVcKick] Failed to load persistent cache", error);
            }
        })();
    }

    await loadPromise;
}

function saveCache() {
    const snapshot: PersistedCache = {
        users: Array.from(userCache.entries()),
        members: Array.from(memberCache.entries())
    };

    // Serialize writes to prevent older snapshots overwriting newer ones.
    saveQueue = saveQueue
        .then(() => DataStore.set(CACHE_KEY, snapshot))
        .catch(error => {
            console.error("[AutoVcKick] Failed to save persistent cache", error);
        });
}

function isFresh<T>(entry?: CacheEntry<T>) {
    return !!entry && entry.expiresAt > Date.now();
}

export async function getCachedUser(id: string): Promise<CachedUser | null> {
    await loadCache();

    const cached = userCache.get(id);

    if (isFresh(cached)) return cached!.value;

    const pending = userRequests.get(id);
    if (pending) return pending;

    const request = (async () => {
        try {
            const response = await RestAPI.get({
                url: `/users/${id}/profile`,
                query: {
                    with_mutual_guilds: true,
                    with_mutual_friends_count: true
                }
            });

            const user = response.body?.user as CachedUser | undefined;
            if (!user?.id) return cached?.value ?? null;

            userCache.set(id, {
                value: user,
                expiresAt: Date.now() + USER_TTL
            });

            saveCache();

            return user;
        } catch (error) {
            console.error(`[AutoVcKick] Failed to fetch user ${id}`, error);
            return cached?.value ?? null;
        } finally {
            userRequests.delete(id);
        }
    })();

    userRequests.set(id, request);

    return request;
}

export async function getCachedMember(
    guildId: string,
    userId: string
): Promise<CachedMember | null> {
    await loadCache();

    const key = `${guildId}:${userId}`;
    const cached = memberCache.get(key);

    if (isFresh(cached)) return cached!.value;

    const pending = memberRequests.get(key);
    if (pending) return pending;

    const request = (async () => {
        try {
            const response = await RestAPI.get({
                url: `/guilds/${guildId}/members/${userId}`
            });

            const member = response.body as CachedMember;

            memberCache.set(key, {
                value: member,
                expiresAt: Date.now() + MEMBER_TTL
            });

            saveCache();

            return member;
        } catch (error) {
            console.error(`[AutoVcKick] Failed to fetch guild member ${userId}`, error);
            return cached?.value ?? null;
        } finally {
            memberRequests.delete(key);
        }
    })();

    memberRequests.set(key, request);

    return request;
}

export async function clearUserCache(userId?: string) {
    await loadCache();

    if (!userId) {
        userCache.clear();
        memberCache.clear();
        saveCache();
        return;
    }

    userCache.delete(userId);

    for (const key of memberCache.keys()) {
        if (key.endsWith(`:${userId}`)) {
            memberCache.delete(key);
        }
    }

    saveCache();
}
