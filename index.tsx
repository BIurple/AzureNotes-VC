/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2024 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import "./style.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { DataStore } from "@api/index";
import { addMessagePopoverButton, removeMessagePopoverButton } from "@api/MessagePopover";
import ErrorBoundary from "@components/ErrorBoundary";
import { classes } from "@utils/misc";
import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { findByProps, findExportedComponentLazy } from "@webpack";
import { ChannelStore, Menu, openModal } from "@webpack/common";

import { Popover as NoteButtonPopover, Popover } from "./components/icons/NoteButton";
import { NoteModal } from "./components/modals/Notebook";
import noteHandler, { noteHandlerCache } from "./NoteHandler";
import { DataStoreToCache, HolyNoteStore } from "./utils";

const HeaderBarIcon = findExportedComponentLazy("Icon", "Divider");

const messageContextMenuPatch: NavContextMenuPatchCallback = async (children, { message }: { message: Message; }) => {
    children.push(
        <Menu.MenuItem label="Add Message To" id="add-message-to-note">
            {Object.keys(noteHandler.getAllNotes()).map((notebook: string, index: number) => (
                <Menu.MenuItem
                    key={notebook}
                    label={notebook}
                    id={notebook}
                    action={() => noteHandler.addNote(message, notebook)}
                />
            ))}
        </Menu.MenuItem>
    );
};

function ToolBarHeader() {
    const iconClasses = findByProps("iconWrapper", "clickable");

    return (
        <ErrorBoundary noop={true}>
            <HeaderBarIcon
                tooltip="Holy Notes"
                position="bottom"
                className={classes("vc-note-button", iconClasses.iconWrapper, iconClasses.clickable)}
                icon={e => Popover(e)}
                onClick={() => openModal(props => <NoteModal {...props} />)}
            />
        </ErrorBoundary>
    );
}

export default definePlugin({
    name: "HolyNotes",
    description: "Holy Notes allows you to save messages, similar to Discord's Bookmark feature.",
    authors: [{ id: 347096063569559553n, name: "wolfieeeeeeee" }],
    dependencies: ["MessagePopoverAPI", "ChatInputButtonAPI"],

    patches: [
        {
            find: ".controlButtonWrapper,",
            replacement: {
                match: /(function \i\(\i\){)(.{1,200}toolbar.{1,100}mobileToolbar)/,
                replace: "$1$self.toolbarAction(arguments[0]);$2"
            }
        }
    ],

    toolboxActions: {
        async "Open Notes"() {
            openModal(props => <NoteModal {...props} />);
        }
    },

    contextMenus: {
        "message": messageContextMenuPatch
    },

    toolbarAction(e) {
        if (Array.isArray(e.toolbar))
            return e.toolbar.push(
                <ErrorBoundary key={this.name} noop={true}>
                    <ToolBarHeader />
                </ErrorBoundary>
            );

        e.toolbar = [
            <ErrorBoundary key={this.name} noop={true}>
                <ToolBarHeader />
            </ErrorBoundary>,
            e.toolbar,
        ];
    },

    async start() {
        // 1. Unconditionally hydrate all notebooks from DataStore into cache first
        await DataStoreToCache();

        // 2. Create the default "Main" notebook only if it doesn't already exist
        if (!noteHandlerCache.has("Main")) {
            await noteHandler.newNoteBook("Main", true);
        }

        // 3. Register the popover button
        addMessagePopoverButton("HolyNotes", message => {
            return {
                label: "Save Note",
                icon: NoteButtonPopover,
                message: message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => noteHandler.addNote(message, "Main")
            };
        }, NoteButtonPopover);
    },

    async stop() {
        removeMessagePopoverButton("HolyNotes");
    }
});
