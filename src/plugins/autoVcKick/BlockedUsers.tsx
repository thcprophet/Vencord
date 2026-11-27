
import { useEffect, useState } from "@webpack/common";
import { getCachedMember, getCachedUser } from "./userCache";

interface Props {
    blockedUsers: string;
    guildId?: string | null;
    onChange: (value: string) => void;
}

export function BlockedUsers({ blockedUsers, guildId, onChange }: Props) {
    const [users, setUsers] = useState<Record<string, {
        user?: Awaited<ReturnType<typeof getCachedUser>>;
        member?: Awaited<ReturnType<typeof getCachedMember>>;
    }>>({});
    const [newId, setNewId] = useState("");

    const blocked = blockedUsers.split(/[\s,]+/).filter(Boolean);

    useEffect(() => {
        let cancelled = false;

        async function loadUsers() {
            const results: typeof users = {};

            await Promise.all(blocked.map(async id => {
                const [user, member] = await Promise.all([
                    getCachedUser(id),
                    guildId ? getCachedMember(guildId, id) : Promise.resolve(null)
                ]);

                results[id] = { user, member };
            }));

            if (!cancelled) setUsers(results);
        }

        loadUsers();

        return () => {
            cancelled = true;
        };
    }, [blockedUsers, guildId]);

    const updateBlocked = (next: string[]) => {
        onChange([...new Set(next.map(id => id.trim()).filter(Boolean))].join(", "));
    };

    const addUser = () => {
        const id = newId.trim();

        if (!/^\d{17,20}$/.test(id) || blocked.includes(id)) return;

        updateBlocked([...blocked, id]);
        setNewId("");
    };

    return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--header-primary)" }}>
            Blocked users
        </div>

        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Manage blocked users. You can also add or remove users from their context menu.
        </div>

        {blocked.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                No users are currently blocked.
            </div>
        )}

        {blocked.map(id => {
            const resolved = users[id];
            const user = resolved?.user;
            const member = resolved?.member;

            const username = user?.username;
            const displayName =
                member?.nick ||
                user?.global_name ||
                username ||
                "Loading profile...";

            const avatar = user?.avatar;
            const memberAvatar = member?.avatar;

            const avatarUrl = memberAvatar && guildId
                ? `https://cdn.discordapp.com/guilds/${guildId}/users/${id}/avatars/${memberAvatar}.${memberAvatar.startsWith("a_") ? "gif" : "png"}?size=64`
                : avatar
                    ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.${avatar.startsWith("a_") ? "gif" : "png"}?size=64`
                    : user
                        ? `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(id) >> 22n) % 6n)}.png`
                        : null;

            return <div key={id} style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 0",
                borderBottom: "1px solid var(--border-subtle)"
            }}>
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt=""
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            flexShrink: 0,
                            objectFit: "cover"
                        }}
                    />
                ) : (
                    <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "var(--background-modifier-accent)",
                        flexShrink: 0
                    }} />
                )}

                <div style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2
                }}>
                    <span style={{
                        color: "var(--header-primary)",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}>
                        {displayName}
                    </span>

                    <span style={{
                        color: "var(--text-muted)",
                        fontSize: 12,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}>
                        {username ? `@${username}` : id}
                    </span>
                </div>

                <button
                    style={{
                        padding: "7px 10px",
                        border: 0,
                        borderRadius: 5,
                        background: "var(--button-danger-background, #da373c)",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 600
                    }}
                    onClick={() => updateBlocked(blocked.filter(value => value !== id))}
                >
                    Remove
                </button>
            </div>;
        })}

        <div style={{ display: "flex", gap: 8 }}>
            <input
                value={newId}
                onChange={event => setNewId(event.currentTarget.value)}
                onKeyDown={event => {
                    if (event.key === "Enter") addUser();
                }}
                placeholder="Discord user ID"
                style={{
                    flex: 1,
                    minWidth: 0,
                    boxSizing: "border-box",
                    padding: "9px 10px",
                    borderRadius: 5,
                    border: "1px solid var(--input-border, var(--border-subtle))",
                    background: "var(--input-background, var(--background-secondary))",
                    color: "var(--text-normal)",
                    font: "inherit"
                }}
            />

            <button
                onClick={addUser}
                style={{
                    padding: "8px 12px",
                    border: 0,
                    borderRadius: 5,
                    background: "var(--brand-500)",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 600
                }}
            >
                Add
            </button>
        </div>
    </div>;
}
