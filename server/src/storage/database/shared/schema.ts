import { pgTable, bigint, serial, timestamp, varchar, text, jsonb, integer, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 人物（诗人 / 作者 / 历史人物）
export const authors = pgTable("authors", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	name: varchar("name", { length: 64 }).notNull(),
	name_traditional: varchar("name_traditional", { length: 64 }),
	dynasty: varchar("dynasty", { length: 32 }).notNull(),
	avatar_emoji: varchar("avatar_emoji", { length: 16 }),
	avatar_url: text("avatar_url"),
	bio: text("bio"),
	canonical_author_id: varchar("canonical_author_id", { length: 36 }),
	evaluation: text("evaluation"),
	timeline: jsonb("timeline"),
	editorial_sources: jsonb("editorial_sources"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("authors_dynasty_idx").on(table.dynasty),
]);

// 作品集（如《战国策》《两当轩集》）
export const works = pgTable("works", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	name: varchar("name", { length: 128 }).notNull(),
	author_id: varchar("author_id", { length: 36 }).references(() => authors.id),
	era: varchar("era", { length: 32 }),
	description: text("description"),
	cover_emoji: varchar("cover_emoji", { length: 16 }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("works_author_id_idx").on(table.author_id),
]);

// 诗文
export const poems = pgTable("poems", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	title: varchar("title", { length: 128 }).notNull(),
	author_id: varchar("author_id", { length: 36 }).references(() => authors.id),
	work_id: varchar("work_id", { length: 36 }).references(() => works.id),
	dynasty: varchar("dynasty", { length: 32 }),
	genre: varchar("genre", { length: 32 }).default("诗"),
	// 正文（简化字，按行以 \n 分隔）
	content: text("content").notNull(),
	// 繁体正文（按行以 \n 分隔）
	content_traditional: text("content_traditional"),
	// 拼音：jsonb 数组，第 i 项对应第 i 行，每项为 [{ c: 字, p: 拼音 }]
	pinyin: jsonb("pinyin"),
	annotation: text("annotation"),
	annotation_notes: jsonb("annotation_notes"),
	creation_background: text("creation_background"),
	background_source: jsonb("background_source"),
	analysis_provenance: jsonb("analysis_provenance").default(sql`'{}'::jsonb`),
	translation: text("translation"),
	appreciation: text("appreciation"),
	cover_emoji: varchar("cover_emoji", { length: 16 }),
	background_hint: varchar("background_hint", { length: 16 }),
	read_count: integer("read_count").default(0).notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("poems_author_id_idx").on(table.author_id),
	index("poems_work_id_idx").on(table.work_id),
]);

// 人际关系
export const relationships = pgTable("relationships", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	author_id: varchar("author_id", { length: 36 }).notNull().references(() => authors.id),
	related_author_id: varchar("related_author_id", { length: 36 }).references(() => authors.id),
	relation: varchar("relation", { length: 64 }).notNull(),
	note: text("note"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("relationships_author_id_idx").on(table.author_id),
	index("relationships_related_author_id_idx").on(table.related_author_id),
]);

// 阅读/搜索习惯记录（用于每日推荐个性化）
export const reading_logs = pgTable("reading_logs", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	device_id: varchar("device_id", { length: 64 }).notNull(),
	poem_id: varchar("poem_id", { length: 36 }).references(() => poems.id),
	author_id: varchar("author_id", { length: 36 }).notNull().references(() => authors.id),
	action: varchar("action", { length: 16 }).notNull().default("read"),
	keyword: varchar("keyword", { length: 128 }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("reading_logs_device_id_idx").on(table.device_id),
	index("reading_logs_author_id_idx").on(table.author_id),
]);
// 同一作品可收入不同文集，卷次和篇序归属于具体收录条目。
export const collectionEntries = pgTable("collection_entries", {
  id: bigint("id", { mode: 'number' }).primaryKey(),
  work_id: text("work_id").notNull().references(() => works.id),
  poem_id: text("poem_id").notNull().references(() => poems.id),
  volume: text("volume"),
  sort_order: integer("sort_order").notNull(),
  entry_title: text("entry_title"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
