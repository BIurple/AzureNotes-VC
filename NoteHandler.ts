/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Channel, Message } from "@vencord/discord-types";
import { findByCode } from "@webpack";
import { ChannelStore, lodash, Toasts, UserStore } from "@webpack/common";

import { Discord, HolyNotes } from "./types";
import { deleteCacheFromDataStore, DeleteEntireStore, saveCacheToDataStore } from "./utils";

export const noteHandlerCache = new Map<string, Record<string, HolyNotes.Note>>();

export class NoteHandler {
    private _formatNote(channel: Channel, message: Message): HolyNotes.Note {
    const rawNote = {
        id: message.id,
        channel_id: message.channel_id,
        guild_id: channel.guild_id,
        content: message.content,
        author: {
            id: message.author.id,
            avatar: message.author.avatar,
            discriminator: message.author.discriminator,
            username: message.author.username,
        },
        flags: message.flags,
        timestamp: message.timestamp.toString(),
        attachments: message.attachments as Discord.Attachment[],
        embeds: message.embeds,
        reactions: message.reactions as Discord.Reaction[],
        stickerItems: message.stickerItems,
    };

    // Drops all Discord getter functions & rich prototype methods
    return JSON.parse(JSON.stringify(rawNote));
}

    public getNotes(notebook?: string): Record<string, HolyNotes.Note> {
        if (!notebook) return {};
        return noteHandlerCache.get(notebook) || {};
    }

    public getAllNotes(): Record<string, Record<string, HolyNotes.Note>> {
        const notes: Record<string, Record<string, HolyNotes.Note>> = {};
        for (const [key, value] of noteHandlerCache.entries()) {
            notes[key] = value;
        }
        return notes;
    }

    public async addNote(message: Message, notebook: string) {
        const notes = this.getNotes(notebook);
        const channel = ChannelStore.getChannel(message.channel_id);
        const formattedNote = this._formatNote(channel, message);

        const newNotes = {
            [message.id]: formattedNote,
            ...notes,
        };

        noteHandlerCache.set(notebook, newNotes);
        await saveCacheToDataStore(notebook, newNotes);

        Toasts.show({
            id: Toasts.genId(),
            message: `Successfully added note to ${notebook}.`,
            type: Toasts.Type.SUCCESS,
        });
    }

    public async deleteNote(noteId: string, notebook: string) {
        const notes = this.getNotes(notebook);
        const updated = lodash.omit(notes, noteId);

        noteHandlerCache.set(notebook, updated);
        await saveCacheToDataStore(notebook, updated);

        Toasts.show({
            id: Toasts.genId(),
            message: `Successfully deleted note from ${notebook}.`,
            type: Toasts.Type.SUCCESS,
        });
    }

    public async moveNote(note: HolyNotes.Note, from: string, to: string) {
        const origNotebook = this.getNotes(from);
        const newNoteBook = lodash.cloneDeep(this.getNotes(to));

        newNoteBook[note.id] = note;
        const updatedFrom = lodash.omit(origNotebook, note.id);

        noteHandlerCache.set(from, updatedFrom);
        noteHandlerCache.set(to, newNoteBook);

        await saveCacheToDataStore(from, updatedFrom);
        await saveCacheToDataStore(to, newNoteBook);

        Toasts.show({
            id: Toasts.genId(),
            message: `Successfully moved note from ${from} to ${to}.`,
            type: Toasts.Type.SUCCESS,
        });
    }

    public async newNoteBook(notebookName: string, silent?: boolean) {
        if (noteHandlerCache.has(notebookName)) {
            if (!silent) {
                Toasts.show({
                    id: Toasts.genId(),
                    message: `Notebook ${notebookName} already exists.`,
                    type: Toasts.Type.FAILURE,
                });
            }
            return;
        }

        noteHandlerCache.set(notebookName, {});
        await saveCacheToDataStore(notebookName, {});

        if (!silent) {
            Toasts.show({
                id: Toasts.genId(),
                message: `Successfully created ${notebookName}.`,
                type: Toasts.Type.SUCCESS,
            });
        }
    }

    public async deleteNotebook(notebookName: string) {
        noteHandlerCache.delete(notebookName);
        await deleteCacheFromDataStore(notebookName);

        Toasts.show({
            id: Toasts.genId(),
            message: `Successfully deleted ${notebookName}.`,
            type: Toasts.Type.SUCCESS,
        });
    }

    public async refreshAvatars() {
        const notebooks = this.getAllNotes();
        const User = findByCode("tag", "isClyde");

        for (const notebook in notebooks) {
            for (const noteId in notebooks[notebook]) {
                const note = notebooks[notebook][noteId];
                const user = UserStore.getUser(note.author.id) ?? new User({ ...note.author });

                Object.assign(notebooks[notebook][noteId].author, {
                    avatar: user.avatar,
                    discriminator: user.discriminator,
                    username: user.username,
                });
            }
        }

        for (const notebook in notebooks) {
            noteHandlerCache.set(notebook, notebooks[notebook]);
            await saveCacheToDataStore(notebook, notebooks[notebook]);
        }

        Toasts.show({
            id: Toasts.genId(),
            message: "Successfully refreshed avatars.",
            type: Toasts.Type.SUCCESS,
        });
    }

    public async deleteEverything() {
        noteHandlerCache.clear();
        await DeleteEntireStore();

        Toasts.show({
            id: Toasts.genId(),
            message: "Successfully deleted all notes.",
            type: Toasts.Type.SUCCESS,
        });
    }

    public async exportNotes() {
        return this.getAllNotes();
    }

    public async importNotes(notesData: unknown) {
        try {
            const parseNotes = typeof notesData === "string" ? JSON.parse(notesData) : notesData;

            for (const notebook in parseNotes) {
                noteHandlerCache.set(notebook, parseNotes[notebook]);
                await saveCacheToDataStore(notebook, parseNotes[notebook]);
            }

            Toasts.show({
                id: Toasts.genId(),
                message: "Successfully imported notes.",
                type: Toasts.Type.SUCCESS,
            });
        } catch (e) {
            console.error("[HolyNotes] Import error:", e);
            Toasts.show({
                id: Toasts.genId(),
                message: "Invalid JSON.",
                type: Toasts.Type.FAILURE,
            });
        }
    }
}

export default new NoteHandler();
