import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { ModalCloseButton, ModalRoot, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { ScrollerThin, useState } from "@webpack/common";

import { settings as autoKickSettings } from "../autoVcKick";
import { settings as autoJoinSettings, getWatchedChannelId, stopWatching } from "../autoJoinVc";
import { RulesEditor, settings as commandSettings } from "../userCommands";

const buttonStyle = {
    padding: "8px 12px", border: 0, borderRadius: 5, background: "var(--brand-500)",
    color: "white", cursor: "pointer", fontWeight: 600
};
const dangerButtonStyle = { ...buttonStyle, background: "var(--button-danger-background, #da373c)" };
const cardStyle = {
    border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 14,
    display: "flex", flexDirection: "column" as const, gap: 10
};
const titleStyle = { fontSize: 16, fontWeight: 700, color: "var(--header-primary)" };
const descriptionStyle = { fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 };
const fieldStyle = {
    width: "100%", boxSizing: "border-box" as const, padding: "9px 10px", borderRadius: 5,
    border: "1px solid var(--input-border, var(--border-subtle))",
    background: "var(--input-background, var(--background-secondary))", color: "var(--text-normal)", font: "inherit"
};

function DiscordSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void; }) {
    return (
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
            <span>{label}</span>
            <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={event => { event.preventDefault(); onChange(!checked); }} style={{
                width: 40, height: 24, padding: 3, border: 0, borderRadius: 999,
                background: checked ? "var(--status-positive, #23a55a)" : "var(--background-modifier-accent, #4e5058)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: checked ? "flex-end" : "flex-start"
            }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px #0005" }} />
            </button>
        </label>
    );
}

function AutoKickSection() {
    const { enabled, blockedUsers, guildIds } = autoKickSettings.use(["enabled", "blockedUsers", "guildIds"]);
    const blocked = blockedUsers.split(/[\s,]+/).filter(Boolean);
    const updateBlocked = (next: string[]) => {
        autoKickSettings.store.blockedUsers = [...new Set(next.map(value => value.trim()).filter(Boolean))].join(", ");
    };

    return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={cardStyle}>
            <div style={titleStyle}>AutoVcKick</div>
            <div style={descriptionStyle}>Automatically disconnect users in your block list when they join a voice channel.</div>
            <DiscordSwitch label="Auto-kick enabled" checked={enabled} onChange={value => autoKickSettings.store.enabled = value} />
        </div>
        <div style={cardStyle}>
            <div style={titleStyle}>Blocked users</div>
            <div style={descriptionStyle}>Manage Discord user IDs. You can also add or remove users from their context menu.</div>
            {blocked.length === 0 && <div style={descriptionStyle}>No users are currently blocked.</div>}
            {blocked.map(id => <div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code style={{ flex: 1, overflowWrap: "anywhere" }}>{id}</code>
                <button style={dangerButtonStyle} onClick={() => updateBlocked(blocked.filter(value => value !== id))}>Remove</button>
            </div>)}
            <input style={fieldStyle} placeholder="Enter a user ID and press Add" id="prophet-control-new-user" />
            <button style={buttonStyle} onClick={() => {
                const input = document.getElementById("prophet-control-new-user") as HTMLInputElement | null;
                const value = input?.value.trim();
                if (!value) return;
                updateBlocked([...blocked, value]);
                if (input) input.value = "";
            }}>Add user ID</button>
        </div>
        <div style={cardStyle}>
            <div style={titleStyle}>Server restrictions</div>
            <div style={descriptionStyle}>Leave empty to apply the block list in every server. Separate multiple server IDs with commas or spaces.</div>
            <textarea style={{ ...fieldStyle, minHeight: 72, resize: "vertical" }} value={guildIds} onChange={event => autoKickSettings.store.guildIds = event.currentTarget.value} placeholder="Server IDs (optional)" />
        </div>
    </div>;
}

function AutoJoinSection() {
    const { switchFromOtherVc } = autoJoinSettings.use(["switchFromOtherVc"]);
    const watchedId = getWatchedChannelId();
    return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={cardStyle}>
            <div style={titleStyle}>AutoJoinVc</div>
            <div style={descriptionStyle}>Wait for a free slot in a full voice channel and join automatically.</div>
            <DiscordSwitch label="Switch from another voice channel when a slot opens" checked={switchFromOtherVc} onChange={value => autoJoinSettings.store.switchFromOtherVc = value} />
        </div>
        <div style={cardStyle}>
            <div style={titleStyle}>Current watch</div>
            {watchedId ? <>
                <div style={descriptionStyle}>Watching voice channel ID:</div>
                <code style={{ overflowWrap: "anywhere" }}>{watchedId}</code>
                <button style={dangerButtonStyle} onClick={() => stopWatching("Auto-join cancelled")}>Stop watching</button>
            </> : <div style={descriptionStyle}>Not currently watching a voice channel. Right-click a full voice channel and choose “Auto-join when a spot opens”.</div>}
        </div>
    </div>;
}

function CommandsSection() {
    const { rules } = commandSettings.use(["rules"]);
    return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={cardStyle}>
            <div style={titleStyle}>userCommands</div>
            <div style={descriptionStyle}>Configure slash commands and their per-server messages. Changes are saved to the plugin's existing rules setting.</div>
            <div style={descriptionStyle}>{rules.length} rule(s) configured</div>
        </div>
        <div style={cardStyle}><RulesEditor /></div>
    </div>;
}

const Root = ModalRoot as any;
const CloseButton = ModalCloseButton as any;

const TABS = [
    { id: "AutoVcKick", label: "AutoVcKick" },
    { id: "AutoJoinVc", label: "AutoJoinVc" },
    { id: "userCommands", label: "userCommands" }
];

function SidebarItem({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void; }) {
    const [hover, setHover] = useState(false);
    return <button
        type="button"
        role="tab"
        aria-selected={selected}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
            display: "block", width: "100%", textAlign: "left", border: 0, cursor: "pointer",
            padding: "8px 10px", marginBottom: 2, borderRadius: 4, font: "inherit", fontSize: 16, lineHeight: "20px",
            fontWeight: selected ? 500 : 400,
            background: selected ? "var(--background-modifier-selected)" : hover ? "var(--background-modifier-hover)" : "transparent",
            color: selected ? "var(--interactive-active, var(--header-primary))" : "var(--interactive-normal, var(--text-muted))"
        }}
    >{label}</button>;
}


function ControlCenterModal(props: any) {
    const [activeTab, setActiveTab] = useState("AutoVcKick");
    const current = TABS.find(tab => tab.id === activeTab)!;

    return <Root {...props} size="large">
        <div style={{
            display: "flex",
            width: 1040,
            height: 700,
            maxWidth: "92vw",
            maxHeight: "88vh",
            boxSizing: "border-box",
            overflow: "hidden"
        }}>
            {/* Sidebar */}
            <nav role="tablist" aria-orientation="vertical" style={{
                flex: "0 0 240px",
                boxSizing: "border-box",
                padding: "24px 12px",
                overflow: "hidden",
                borderRight: "1px solid var(--border-subtle"
            }}>
                <div style={{
                    padding: "0 10px 14px",
                    marginBottom: 12,
                    borderBottom: "1px solid var(--border-subtle)",
                    fontSize: 16,
                    lineHeight: "20px",
                    fontWeight: 700,
                    color: "var(--header-primary)"
                }}>
                    thcProphet's Plugin Dashboard
                </div>

                <div style={{
                    padding: "0 10px 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--header-secondary, var(--text-muted))"
                }}>
                    Plugins
                </div>

                {TABS.map(tab => (
                    <SidebarItem
                        key={tab.id}
                        label={tab.label}
                        selected={tab.id === activeTab}
                        onClick={() => setActiveTab(tab.id)}
                    />
                ))}
            </nav>

            {/* Content pane */}
            <div style={{
                flex: "1 1 0",
                minWidth: 0,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
            }}>
                {/* Header */}
                <div style={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    height: 56,
                    boxSizing: "border-box",
                    padding: "0 16px 0 20px",
                    borderBottom: "1px solid var(--border-subtle"
                }}>
                    <div style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--header-primary)"
                    }}>
                        {current.label}
                    </div>

                    <CloseButton onClick={props.onClose} />
                </div>

                {/* Scrollable content */}
                <ScrollerThin
                    orientation="auto"
                    fade
                    style={{
                        flex: "1 1 0",
                        minWidth: 0,
                        minHeight: 0,
                        width: "100%"
                    }}
                >
                    <div style={{
                        width: "100%",
                        maxWidth: 700,
                        boxSizing: "border-box",
                        margin: "0 auto",
                        padding: "24px 24px 32px"
                    }}>
                        {activeTab === "AutoVcKick" && <AutoKickSection />}
                        {activeTab === "AutoJoinVc" && <AutoJoinSection />}
                        {activeTab === "userCommands" && <CommandsSection />}
                    </div>
                </ScrollerThin>
            </div>
        </div>
    </Root>;
}


function ControlCenterIcon({ height = 20, width = 20 }: { height?: number; width?: number; }) {
    return <svg viewBox="0 0 24 24" height={height} width={width} fill="currentColor" aria-hidden="true">
        <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h16v2H4z" />
        <circle cx="8" cy="6" r="2" fill="var(--background-primary)" />
        <circle cx="15" cy="12" r="2" fill="var(--background-primary)" />
        <circle cx="10" cy="18" r="2" fill="var(--background-primary)" />
    </svg>;
}

const ControlCenterButton: ChatBarButtonFactory = ({ isMainChat }) => {
    if (!isMainChat) return null;
    return <ChatBarButton tooltip="Open Prophet Control Center" onClick={() => openModal(props => <ControlCenterModal {...props} />)} buttonProps={{ "aria-haspopup": "dialog" }}>
        <ControlCenterIcon />
    </ChatBarButton>;
};

export default definePlugin({
    name: "ProphetControlCenter",
    description: "A unified in-Discord control panel for AutoVcKick, AutoJoinVc and userCommands",
    authors: [{ name: "thcProphet", id: 828010614349365288n }],
    chatBarButton: { icon: ControlCenterIcon, render: ControlCenterButton }
});