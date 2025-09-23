import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class UsageApiLatest {
    @Prop()
    used?: number;
    @Prop()
    remaining?: number;
    @Prop()
    lastRequestCost?: number;
}

export type UsageApiLatestDocument = UsageApiLatest & Document;
export const UsageApiLatestSchema = SchemaFactory.createForClass(UsageApiLatest);
