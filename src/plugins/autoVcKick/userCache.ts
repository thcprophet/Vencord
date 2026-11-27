
import { RestAPI } from "@webpack/common";

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

const userCache = new Map<string, CacheEntry<CachedUser>>();
const memberCache = new Map<string, CacheEntry<CachedMember>>();

const userRequests = new Map<string, Promise<CachedUser | null>>();
const memberRequests = new Map<string, Promise<CachedMember | null>>();

function isFresh<T>(entry?: CacheEntry<T>) {
    return !!entry && entry.expiresAt > Date.now();
}

export async function getCachedUser(id: string): Promise<CachedUser | null> {
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

            return member;
        } catch {
            return cached?.value ?? null;
        } finally {
            memberRequests.delete(key);
        }
    })();

    memberRequests.set(key, request);

    return request;
}

export function clearUserCache(userId?: string) {
    if (!userId) {
        userCache.clear();
        memberCache.clear();
        return;
    }

    userCache.delete(userId);

    for (const key of memberCache.keys()) {
        if (key.endsWith(`:${userId}`)) {
            memberCache.delete(key);
        }
    }
}
