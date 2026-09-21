/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createStore } from "@api/DataStore";
import { DataStore } from "@api/index";
import { Toasts } from "@webpack/common";

import noteHandler, { noteHandlerCache } from "./NoteHandler";
import { HolyNotes } from "./types";

export const HolyNoteStore = createStore("HolyNoteData", "HolyNoteStore");

export async function saveCacheToDataStore(key: string, value: Record<string, HolyNotes.Note>) {
    try {
        // Strip non-cloneable functions/methods attached by Discord internals
        const cleanValue = JSON.parse(JSON.stringify(value));
        await DataStore.set(key, cleanValue, HolyNoteStore);
    } catch (err) {
        console.error("[HolyNotes] Failed to save note to DataStore:", err);
    }
}

export async function deleteCacheFromDataStore(key: string) {
    try {
        await DataStore.del(key, HolyNoteStore);
    } catch (err) {
        console.error("[HolyNotes] Failed to delete key from DataStore:", err);
    }
}

export async function getFormatedEntries(): Promise<Record<string, Record<string, HolyNotes.Note>>> {
    try {
        const data = await DataStore.entries(HolyNoteStore);
        const notebooks: Record<string, Record<string, HolyNotes.Note>> = {};

        if (Array.isArray(data)) {
            data.forEach(([key, value]) => {
                if (key) {
                    notebooks[String(key)] = value ?? {};
                }
            });
        }
        return notebooks;
    } catch (err) {
        console.error("[HolyNotes] Failed to format entries:", err);
        return {};
    }
}

export async function DataStoreToCache() {
    try {
        const data = await DataStore.entries(HolyNoteStore);
        if (Array.isArray(data)) {
            data.forEach(([key, value]) => {
                if (key) {
                    noteHandlerCache.set(String(key), value ?? {});
                }
            });
        }
    } catch (err) {
        console.error("[HolyNotes] Failed to load DataStore to cache:", err);
    }
}

export async function DeleteEntireStore() {
    await DataStore.clear(HolyNoteStore);
    return noteHandler.newNoteBook("Main", true);
}

export async function downloadNotes() {
    const filename = "notes.json";
    const exportData = await noteHandler.exportNotes();
    const data = JSON.stringify(exportData, null, 2);

    if (IS_VESKTOP || IS_WEB) {
        const file = new File([data], filename, { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        setImmediate(() => {
            URL.revokeObjectURL(a.href);
            document.body.removeChild(a);
        });
    } else {
        DiscordNative.fileManager.saveWithDialog(data, filename);
    }
}

export async function uploadNotes() {
    if (IS_VESKTOP || IS_WEB) {
        const input = document.createElement("input");
        input.type = "file";
        input.style.display = "none";
        input.accept = "application/json";
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    await noteHandler.importNotes(reader.result as unknown as HolyNotes.Note[]);
                } catch (err) {
                    console.error(err);
                    Toasts.show({
                        id: Toasts.genId(),
                        message: "Invalid JSON.",
                        type: Toasts.Type.FAILURE,
                    });
                }
            };
            reader.readAsText(file);
        };

        document.body.appendChild(input);
        input.click();
        setImmediate(() => document.body.removeChild(input));
    } else {
        const [file] = await DiscordNative.fileManager.openFiles({ filters: [{ name: "notes", extensions: ["json"] }] });

        if (file) {
            await noteHandler.importNotes(new TextDecoder().decode(file.data) as unknown as HolyNotes.Note[]);
        }
    }
}
