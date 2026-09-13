import { randomUUID } from "node:crypto";

/**
 * A small in-memory stand-in for the Prisma client.
 *
 * The demo runs with no database, so every page and server action talks to
 * this instead. It implements the part of Prisma's query API the app uses —
 * filters, relation filters, include/select with nested include, _count,
 * orderBy, groupBy, create with nested create, update, delete — with the same
 * defaults, unique rules and foreign keys the archived schema declares. That
 * is what lets the application code stay exactly as it was written against
 * the real database (see archive/database-design).
 *
 * Every operation runs synchronously inside a single call, so each one is
 * atomic. Results are copies; nothing outside can mutate a stored row.
 */

export type Row = Record<string, unknown>;
type Plain = Record<string, unknown>;

export type FieldDef = { required?: true; default?: () => unknown };
export type RelationDef = {
  model: string;
  many: boolean;
  /** Field on this row. */
  local: string;
  /** Field on the related row that must equal `local`. */
  remote: string;
};
export type ModelDef = {
  fields: Record<string, FieldDef>;
  unique: string[][];
  relations: Record<string, RelationDef>;
};
export type Schema = Record<string, ModelDef>;

/** Uses Prisma's error codes so messages read the same as before. */
export class DemoStoreError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "DemoStoreError";
  }
}

export const field = {
  id: { default: () => randomUUID() } as FieldDef,
  now: { default: () => new Date() } as FieldDef,
  required: { required: true } as FieldDef,
  optional: {} as FieldDef,
  value: (v: unknown): FieldDef => ({ default: () => v }),
};

export const relation = {
  /** To-one. */
  one: (model: string, local: string, remote: string): RelationDef => ({
    model,
    many: false,
    local,
    remote,
  }),
  /** To-many, where the related rows point back at this row's id. */
  many: (model: string, remote: string): RelationDef => ({
    model,
    many: true,
    local: "id",
    remote,
  }),
};

const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !(v instanceof Date) && !Array.isArray(v);

const copy = <T>(v: T): T => (v instanceof Date ? (new Date(v.getTime()) as T) : v);

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  return a === b;
}

function compare(a: unknown, b: unknown): number {
  const x = a instanceof Date ? a.getTime() : typeof a === "boolean" ? Number(a) : a;
  const y = b instanceof Date ? b.getTime() : typeof b === "boolean" ? Number(b) : b;
  return (x as number) < (y as number) ? -1 : (x as number) > (y as number) ? 1 : 0;
}

function matchScalar(value: unknown, cond: unknown): boolean {
  if (!isPlain(cond)) return same(value, cond ?? null);

  const fold = (s: unknown) =>
    cond.mode === "insensitive" ? String(s).toLowerCase() : String(s);

  for (const [op, arg] of Object.entries(cond)) {
    if (arg === undefined) continue;
    switch (op) {
      case "equals":
        if (!same(value, arg)) return false;
        break;
      // SQL never matches NULL with != or NOT IN, and neither does this.
      case "not":
        if (arg === null) {
          if (value === null) return false;
        } else if (value === null || (isPlain(arg) ? matchScalar(value, arg) : same(value, arg))) {
          return false;
        }
        break;
      case "in":
        if (!(arg as unknown[]).some((a) => same(value, a))) return false;
        break;
      case "notIn":
        if (value === null || (arg as unknown[]).some((a) => same(value, a))) return false;
        break;
      case "contains":
        if (typeof value !== "string" || !fold(value).includes(fold(arg))) return false;
        break;
      case "startsWith":
        if (typeof value !== "string" || !fold(value).startsWith(fold(arg))) return false;
        break;
      case "endsWith":
        if (typeof value !== "string" || !fold(value).endsWith(fold(arg))) return false;
        break;
      case "lt":
        if (value === null || compare(value, arg) >= 0) return false;
        break;
      case "lte":
        if (value === null || compare(value, arg) > 0) return false;
        break;
      case "gt":
        if (value === null || compare(value, arg) <= 0) return false;
        break;
      case "gte":
        if (value === null || compare(value, arg) < 0) return false;
        break;
      case "mode":
        break;
      default:
        throw new Error(`The demo store does not support the "${op}" filter.`);
    }
  }
  return true;
}

export class Store {
  tables: Record<string, Row[]>;

  constructor(private schema: Schema) {
    this.tables = Object.fromEntries(Object.keys(schema).map((m) => [m, []]));
  }

  clear(): void {
    for (const model of Object.keys(this.tables)) this.tables[model] = [];
  }

  private def(model: string): ModelDef {
    const def = this.schema[model];
    if (!def) throw new Error(`Unknown model ${model}.`);
    return def;
  }

  // ------------------------------------------------------------- reading

  private related(rel: RelationDef, row: Row): Row[] {
    const key = row[rel.local];
    if (key === null || key === undefined) return [];
    return this.tables[rel.model].filter((r) => same(r[rel.remote], key));
  }

  matches(model: string, row: Row, where?: unknown): boolean {
    if (where === undefined || where === null) return true;
    const def = this.def(model);

    for (const [key, cond] of Object.entries(where as Plain)) {
      if (cond === undefined) continue;

      if (key === "AND" || key === "NOT") {
        const list = (Array.isArray(cond) ? cond : [cond]) as Plain[];
        const hit =
          key === "AND"
            ? list.every((w) => this.matches(model, row, w))
            : !list.some((w) => this.matches(model, row, w));
        if (!hit) return false;
        continue;
      }
      if (key === "OR") {
        if (!(cond as Plain[]).some((w) => this.matches(model, row, w))) return false;
        continue;
      }

      const rel = def.relations[key];
      if (rel) {
        if (!this.matchRelation(rel, row, cond)) return false;
        continue;
      }
      if (key in def.fields) {
        if (!matchScalar(row[key], cond)) return false;
        continue;
      }
      // Compound unique input, e.g. { taskId_slotLabel_version: { ... } }.
      if (isPlain(cond)) {
        if (!this.matches(model, row, cond)) return false;
        continue;
      }
      throw new Error(`Unknown field ${model}.${key}.`);
    }
    return true;
  }

  private matchRelation(rel: RelationDef, row: Row, cond: unknown): boolean {
    const list = this.related(rel, row);

    if (rel.many) {
      const c = cond as Plain;
      if (c.some !== undefined && !list.some((r) => this.matches(rel.model, r, c.some))) {
        return false;
      }
      if (c.every !== undefined && !list.every((r) => this.matches(rel.model, r, c.every))) {
        return false;
      }
      if (c.none !== undefined && list.some((r) => this.matches(rel.model, r, c.none))) {
        return false;
      }
      return true;
    }

    const target = list[0] ?? null;
    if (cond === null) return target === null;
    const c = cond as Plain;
    if ("is" in c || "isNot" in c) {
      if (c.is !== undefined) {
        const ok =
          c.is === null ? target === null : target !== null && this.matches(rel.model, target, c.is);
        if (!ok) return false;
      }
      if (c.isNot !== undefined) {
        const hit =
          c.isNot === null
            ? target === null
            : target !== null && this.matches(rel.model, target, c.isNot);
        if (hit) return false;
      }
      return true;
    }
    return target !== null && this.matches(rel.model, target, c);
  }

  private sort(rows: Row[], orderBy: unknown): Row[] {
    if (!orderBy) return rows;
    const keys = ((Array.isArray(orderBy) ? orderBy : [orderBy]) as Plain[]).flatMap((o) =>
      Object.entries(o),
    );
    return [...rows].sort((a, b) => {
      for (const [name, spec] of keys) {
        const dir = typeof spec === "string" ? spec : (spec as Plain | null)?.sort;
        if (dir !== "asc" && dir !== "desc") {
          throw new Error(`The demo store cannot order by ${name}.`);
        }
        const av = a[name];
        const bv = b[name];
        if (same(av, bv)) continue;
        // PostgreSQL puts NULLs last ascending and first descending.
        if (av === null) return dir === "desc" ? -1 : 1;
        if (bv === null) return dir === "desc" ? 1 : -1;
        const c = compare(av, bv);
        if (c !== 0) return dir === "desc" ? -c : c;
      }
      return 0;
    });
  }

  private pipeline(model: string, rows: Row[], args: Plain): Row[] {
    let out = rows.filter((r) => this.matches(model, r, args.where));
    out = this.sort(out, args.orderBy);
    const skip = (args.skip as number | undefined) ?? 0;
    const take = args.take as number | undefined;
    if (skip || take !== undefined) {
      out = out.slice(skip, take === undefined ? undefined : skip + take);
    }
    return out;
  }

  private project(model: string, row: Row, args: Plain): Row {
    const def = this.def(model);
    const out: Row = {};

    if (args.select) {
      for (const [key, spec] of Object.entries(args.select as Plain)) {
        if (!spec) continue;
        if (key === "_count") out._count = this.counts(model, row, spec);
        else if (def.relations[key]) out[key] = this.load(def.relations[key], row, spec);
        else if (key in def.fields) out[key] = copy(row[key]);
        else throw new Error(`Unknown field ${model}.${key}.`);
      }
      return out;
    }

    for (const name of Object.keys(def.fields)) out[name] = copy(row[name]);

    for (const [key, spec] of Object.entries((args.include as Plain | undefined) ?? {})) {
      if (!spec) continue;
      if (key === "_count") {
        out._count = this.counts(model, row, spec);
        continue;
      }
      const rel = def.relations[key];
      if (!rel) throw new Error(`Unknown relation ${model}.${key}.`);
      out[key] = this.load(rel, row, spec);
    }
    return out;
  }

  private load(rel: RelationDef, row: Row, spec: unknown): Row | Row[] | null {
    const args = spec === true ? {} : (spec as Plain);
    if (!rel.many) {
      const target = this.related(rel, row)[0];
      return target ? this.project(rel.model, target, args) : null;
    }
    return this.pipeline(rel.model, this.related(rel, row), args).map((r) =>
      this.project(rel.model, r, args),
    );
  }

  private counts(model: string, row: Row, spec: unknown): Record<string, number> {
    const def = this.def(model);
    const which =
      spec === true
        ? Object.fromEntries(
            Object.entries(def.relations)
              .filter(([, r]) => r.many)
              .map(([k]) => [k, true]),
          )
        : ((spec as Plain).select as Plain);

    const out: Record<string, number> = {};
    for (const [key, s] of Object.entries(which)) {
      if (!s) continue;
      const rel = def.relations[key];
      if (!rel?.many) throw new Error(`Cannot count ${model}.${key}.`);
      const where = s === true ? undefined : (s as Plain).where;
      out[key] = this.related(rel, row).filter((r) => this.matches(rel.model, r, where)).length;
    }
    return out;
  }

  findFirst(model: string, args: Plain = {}): Row | null {
    const [row] = this.pipeline(model, this.tables[model], args);
    return row ? this.project(model, row, args) : null;
  }

  findMany(model: string, args: Plain = {}): Row[] {
    return this.pipeline(model, this.tables[model], args).map((r) =>
      this.project(model, r, args),
    );
  }

  count(model: string, args: Plain = {}): number {
    return this.pipeline(model, this.tables[model], { where: args.where }).length;
  }

  groupBy(model: string, args: Plain): Row[] {
    const by = args.by as string[];
    const groups = new Map<string, Row[]>();
    for (const r of this.pipeline(model, this.tables[model], { where: args.where })) {
      const key = JSON.stringify(
        by.map((f) => (r[f] instanceof Date ? (r[f] as Date).getTime() : r[f])),
      );
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }

    const rows = [...groups.values()].map((list) => {
      const out: Row = {};
      for (const f of by) out[f] = copy(list[0][f]);
      if (args._count) {
        const spec = args._count === true ? { _all: true } : (args._count as Plain);
        const counts: Record<string, number> = {};
        for (const [f, on] of Object.entries(spec)) {
          if (!on) continue;
          counts[f] = f === "_all" ? list.length : list.filter((r) => r[f] !== null).length;
        }
        out._count = counts;
      }
      return out;
    });
    return this.sort(rows, args.orderBy);
  }

  // ------------------------------------------------------------- writing

  private assertUnique(model: string, row: Row, self?: Row): void {
    for (const cols of this.def(model).unique) {
      if (cols.some((c) => row[c] === null)) continue;
      const clash = this.tables[model].some(
        (r) => r !== self && cols.every((c) => same(r[c], row[c])),
      );
      if (clash) {
        throw new DemoStoreError(
          "P2002",
          `Unique constraint failed on ${model} (${cols.join(", ")}).`,
        );
      }
    }
  }

  /** A to-one relation that points at another row's id owns a foreign key. */
  private assertForeignKeys(model: string, row: Row): void {
    for (const [name, rel] of Object.entries(this.def(model).relations)) {
      if (rel.many || rel.remote !== "id") continue;
      const key = row[rel.local];
      if (key === null || key === undefined) continue;
      if (!this.tables[rel.model].some((r) => same(r.id, key))) {
        throw new DemoStoreError(
          "P2003",
          `Foreign key constraint failed on ${model}.${rel.local} (${name}).`,
        );
      }
    }
  }

  private assertRequired(model: string, row: Row): void {
    for (const [name, f] of Object.entries(this.def(model).fields)) {
      if (f.required && (row[name] === null || row[name] === undefined)) {
        throw new DemoStoreError("P2011", `Null constraint violation on ${model}.${name}.`);
      }
    }
  }

  private insert(model: string, data: Plain): Row {
    const def = this.def(model);
    const values: Plain = {};
    const nested: [RelationDef, Plain][] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      const rel = def.relations[key];
      if (rel) {
        const op = value as Plain;
        if (op.connect && !rel.many && rel.remote === "id") {
          const target = this.tables[rel.model].find((r) =>
            this.matches(rel.model, r, op.connect),
          );
          if (!target) {
            throw new DemoStoreError("P2025", `No ${rel.model} to connect for ${model}.${key}.`);
          }
          values[rel.local] = target.id;
        } else if (op.create && rel.local === "id") {
          nested.push([rel, op]);
        } else {
          throw new Error(`The demo store does not support that nested write on ${model}.${key}.`);
        }
        continue;
      }
      if (!(key in def.fields)) throw new Error(`Unknown field ${model}.${key}.`);
      values[key] = copy(value);
    }

    const row: Row = {};
    for (const [name, f] of Object.entries(def.fields)) {
      if (values[name] !== undefined) row[name] = values[name];
      else row[name] = f.default ? f.default() : null;
    }

    this.assertRequired(model, row);
    this.assertUnique(model, row);
    this.assertForeignKeys(model, row);
    this.tables[model].push(row);

    for (const [rel, op] of nested) {
      const items = (Array.isArray(op.create) ? op.create : [op.create]) as Plain[];
      for (const item of items) this.insert(rel.model, { ...item, [rel.remote]: row.id });
    }
    return row;
  }

  create(model: string, args: Plain): Row {
    return this.project(model, this.insert(model, args.data as Plain), args);
  }

  createMany(model: string, args: Plain): { count: number } {
    const list = (Array.isArray(args.data) ? args.data : [args.data]) as Plain[];
    for (const data of list) this.insert(model, data);
    return { count: list.length };
  }

  private applyUpdate(model: string, row: Row, data: Plain): void {
    const def = this.def(model);
    const next: Row = { ...row };

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (def.relations[key]) {
        throw new Error(`The demo store does not support nested updates on ${model}.${key}.`);
      }
      if (!(key in def.fields)) throw new Error(`Unknown field ${model}.${key}.`);

      if (isPlain(value)) {
        const current = next[key] as number;
        if ("set" in value) next[key] = copy(value.set);
        else if ("increment" in value) next[key] = current + (value.increment as number);
        else if ("decrement" in value) next[key] = current - (value.decrement as number);
        else throw new Error(`Unsupported update operation on ${model}.${key}.`);
      } else {
        next[key] = copy(value);
      }
    }

    this.assertRequired(model, next);
    this.assertUnique(model, next, row);
    this.assertForeignKeys(model, next);
    Object.assign(row, next);
  }

  update(model: string, args: Plain): Row {
    const row = this.tables[model].find((r) => this.matches(model, r, args.where));
    if (!row) throw new DemoStoreError("P2025", `No ${model} record was found to update.`);
    this.applyUpdate(model, row, args.data as Plain);
    return this.project(model, row, args);
  }

  updateMany(model: string, args: Plain): { count: number } {
    const rows = this.tables[model].filter((r) => this.matches(model, r, args.where));
    for (const row of rows) this.applyUpdate(model, row, args.data as Plain);
    return { count: rows.length };
  }

  delete(model: string, args: Plain): Row {
    const row = this.tables[model].find((r) => this.matches(model, r, args.where));
    if (!row) throw new DemoStoreError("P2025", `No ${model} record was found to delete.`);
    const out = this.project(model, row, args);
    this.tables[model] = this.tables[model].filter((r) => r !== row);
    return out;
  }

  deleteMany(model: string, args: Plain = {}): { count: number } {
    const before = this.tables[model].length;
    this.tables[model] = this.tables[model].filter((r) => !this.matches(model, r, args.where));
    return { count: before - this.tables[model].length };
  }
}

const OPERATIONS = [
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "groupBy",
  "create",
  "createMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
] as const;

/**
 * Builds a Prisma-shaped client: `client.task.findMany({...})`. The store is
 * looked up on every call, so the data can be reset without re-importing.
 */
export function createClient(schema: Schema, getStore: () => Store): Record<string, unknown> {
  const client: Record<string, unknown> = {};

  for (const model of Object.keys(schema)) {
    const delegate: Record<string, (args?: Plain) => Promise<unknown>> = {};
    for (const op of OPERATIONS) {
      delegate[op] = async (args: Plain = {}) => {
        const store = getStore();
        switch (op) {
          case "findUnique":
          case "findFirst":
            return store.findFirst(model, args);
          case "findUniqueOrThrow":
          case "findFirstOrThrow": {
            const row = store.findFirst(model, args);
            if (!row) throw new DemoStoreError("P2025", `No ${model} record was found.`);
            return row;
          }
          case "findMany":
            return store.findMany(model, args);
          case "count":
            return store.count(model, args);
          case "groupBy":
            return store.groupBy(model, args);
          case "create":
            return store.create(model, args);
          case "createMany":
            return store.createMany(model, args);
          case "update":
            return store.update(model, args);
          case "updateMany":
            return store.updateMany(model, args);
          case "delete":
            return store.delete(model, args);
          case "deleteMany":
            return store.deleteMany(model, args);
        }
      };
    }
    client[model[0].toLowerCase() + model.slice(1)] = delegate;
  }

  client.$transaction = async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (c: unknown) => unknown)(client);
  client.$connect = async () => {};
  client.$disconnect = async () => {};
  return client;
}
