import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('SMTP_HOST');
        const user = config.get<string>('SMTP_USER');
        const pass = config.get<string>('SMTP_PASS');
        const port = Number(config.get<string>('SMTP_PORT')) || 587;
        const from =
          config.get<string>('SMTP_FROM') ||
          (user ? `"ESPN Lines" <${user}>` : '"ESPN Lines" <noreply@localhost>');

        if (!host || !user || !pass) {
          Logger.warn(
            'SMTP_HOST / SMTP_USER / SMTP_PASS not fully set — outbound email will fail until configured.',
            'AppMailerModule',
          );
        }

        return {
          transport: {
            host,
            port,
            secure: port === 465,
            requireTLS: port === 587,
            auth: user && pass ? { user, pass } : undefined,
          },
          defaults: { from },
          template: {
            // Prefer source templates in monorepo; fallback for other cwd layouts
            dir: join(process.cwd(), 'api/src/lib/mailer/templates'),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
    }),
  ],
})
export class AppMailerModule {}
