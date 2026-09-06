import fs = require("fs");
import path = require("path");

export interface DefinitionSourceProvider {
    name?: string;
    priority?: number;
    load(): unknown;
}

export type DefinitionSource = DefinitionSourceProvider | string;

export interface LoadedDefinitionSource<T> {
    name: string;
    owner: string;
    priority: number;
    definitions: T[];
}

export interface DefinitionSourceLoadResult<T> {
    sources: LoadedDefinitionSource<T>[];
    failures: number;
}

interface RegisteredDefinitionSource extends Required<DefinitionSourceProvider> {
    owner: string;
}

export abstract class DefinitionLoader implements Runnable {
    private static readonly sourcesByDefinition = new Map<
        string,
        Map<string, RegisteredDefinitionSource>
    >();

    public static registerSource(
        definitionType: string,
        owner: string,
        source: DefinitionSource
    ): void {
        const type = definitionType?.trim();
        const sourceOwner = owner?.trim();
        if (typeof source === "string" && !source.trim()) {
            throw new Error(`Definition source ${type || "unknown"} requires a JSON file path`);
        }
        const provider: DefinitionSourceProvider = typeof source === "string"
            ? { load: () => JSON.parse(fs.readFileSync(path.resolve(process.cwd(), source), "utf8")) }
            : source;
        const sourceName = provider?.name?.trim() || sourceOwner;
        const priority = provider?.priority ?? 100;
        if (!type) {
            throw new Error("Definition source requires a definition type");
        }
        if (!sourceOwner || !sourceName) {
            throw new Error(`Definition source ${type} requires an owner and name`);
        }
        if (!provider || typeof provider.load !== "function") {
            throw new Error(`Definition source ${type}:${sourceName} requires load()`);
        }
        if (!Number.isFinite(priority)) {
            throw new Error(`Definition source ${type}:${sourceName} has an invalid priority`);
        }

        const sources = this.sourcesByDefinition.get(type) ?? new Map();
        const key = `${sourceOwner}:${sourceName}`;
        if (sources.has(key)) {
            throw new Error(`Definition source ${type}:${key} is already registered`);
        }
        sources.set(key, {
            owner: sourceOwner,
            name: sourceName,
            priority,
            load: provider.load,
        });
        this.sourcesByDefinition.set(type, sources);
    }

    public static getSourceNames(definitionType: string): string[] {
        return this.orderedSources(definitionType).map((source) => source.name);
    }

    protected loadSources<T>(definitionType: string): DefinitionSourceLoadResult<T> {
        const loaded: LoadedDefinitionSource<T>[] = [];
        let failures = 0;
        for (const source of DefinitionLoader.orderedSources(definitionType)) {
            try {
                const definitions = source.load();
                if (!Array.isArray(definitions)) {
                    failures++;
                    console.warn(
                        `[definitions] ${definitionType}:${source.name} returned a non-array value`
                    );
                    continue;
                }
                loaded.push({
                    name: source.name,
                    owner: source.owner,
                    priority: source.priority,
                    definitions: definitions as T[],
                });
            } catch (error) {
                failures++;
                console.error(
                    `[definitions] Failed to load ${definitionType}:${source.name}`,
                    error
                );
            }
        }
        return { sources: loaded, failures };
    }

    private static orderedSources(definitionType: string): RegisteredDefinitionSource[] {
        const sources = this.sourcesByDefinition.get(definitionType.trim());
        if (!sources) {
            return [];
        }
        return Array.from(sources.values()).sort((a, b) => {
            const priorityDifference = a.priority - b.priority;
            return priorityDifference !== 0
                ? priorityDifference
                : a.name.localeCompare(b.name);
        });
    }

    abstract load(): unknown;
    abstract file(): string;
    run() {
        try {
            const start = Date.now();
            this.load();
            const elapsed = Date.now() - start;
            console.log(`Loaded definitions for: ${this.file()}. It took ${elapsed} milliseconds.`);
        } catch (e) {
            console.error(e);
            console.error(`Error loading definitions for: ${this.file()}`);
        }
    }
}

interface Runnable {

    run();
}
