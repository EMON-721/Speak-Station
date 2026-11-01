import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
export const profiles=sqliteTable('profiles',{userId:text('user_id').primaryKey(),name:text('name').notNull(),phone:text('phone').notNull().default(''),target:text('target').notNull().default('8.0'),track:integer('track').notNull().default(120),examDate:text('exam_date').notNull().default(''),createdAt:text('created_at').notNull()});
export const attempts=sqliteTable('attempts',{id:text('id').primaryKey(),userId:text('user_id').notNull(),questionId:text('question_id').notNull(),kind:text('kind').notNull().default('free'),day:integer('day').notNull().default(0),status:text('status').notNull().default('recorded'),transcript:text('transcript').notNull().default(''),duration:integer('duration').notNull(),audioKey:text('audio_key').notNull(),mime:text('mime').notNull(),feedback:text('feedback'),evaluatingAt:text('evaluating_at'),reviewed:integer('reviewed').notNull().default(0),createdAt:text('created_at').notNull()});
export const saved=sqliteTable('saved',{userId:text('user_id').notNull(),type:text('type').notNull(),key:text('key').notNull(),data:text('data').notNull(),reviewed:integer('reviewed').notNull().default(0)},t=>[primaryKey({columns:[t.userId,t.type,t.key]})]);
export const days=sqliteTable('days',{userId:text('user_id').notNull(),day:integer('day').notNull(),completedAt:text('completed_at').notNull()},t=>[primaryKey({columns:[t.userId,t.day]})]);
export const tests=sqliteTable('tests',{id:text('id').primaryKey(),userId:text('user_id').notNull(),milestone:integer('milestone').notNull(),kind:text('kind').notNull(),answers:text('answers').notNull(),completedAt:text('completed_at').notNull()});
export const overrides=sqliteTable('question_overrides',{id:text('id').primaryKey(),data:text('data').notNull(),archived:integer('archived').notNull().default(0)});
export const audit=sqliteTable('audit',{id:text('id').primaryKey(),actor:text('actor').notNull(),action:text('action').notNull(),detail:text('detail').notNull(),createdAt:text('created_at').notNull()});
export const usage=sqliteTable('usage',{userId:text('user_id').notNull(),date:text('date').notNull(),count:integer('count').notNull().default(0)},t=>[primaryKey({columns:[t.userId,t.date]})]);
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const userAccess=sqliteTable('user_access',{userId:text('user_id').primaryKey(),email:text('email').notNull().default(''),status:text('status').notNull().default('active'),reason:text('reason').notNull().default(''),updatedAt:text('updated_at').notNull()});
export const messages=sqliteTable('messages',{id:text('id').primaryKey(),userId:text('user_id').notNull(),subject:text('subject').notNull(),body:text('body').notNull(),reply:text('reply').notNull().default(''),status:text('status').notNull().default('open'),createdAt:text('created_at').notNull()});

export const questionCooldowns=sqliteTable('question_cooldowns',{userId:text('user_id').notNull(),questionId:text('question_id').notNull(),availableAt:text('available_at').notNull()},t=>[primaryKey({columns:[t.userId,t.questionId]})]);

export const studySessions=sqliteTable('study_sessions',{id:text('id').primaryKey(),userId:text('user_id').notNull(),category:text('category').notNull(),kind:text('kind').notNull(),day:integer('day').notNull(),mode:text('mode').notNull(),startedAt:text('started_at').notNull(),expiresAt:text('expires_at').notNull(),completedAt:text('completed_at')});

// Sequential, stable public member number; private Google user_id is stored separately.
export const memberNumbers=sqliteTable('member_numbers',{memberNumber:integer('member_number').primaryKey({autoIncrement:true}),userId:text('user_id').notNull().unique()});
