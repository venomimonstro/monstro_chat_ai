import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { isAdminOrigin, originMatchesAppUrls, parseAppUrls } from './common/utils/app-urls.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);

  validateProductionSecrets(config, logger);

  app.use(helmet());
  app.use(cookieParser());
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>('API_PORT', 3000);
  const clientUrls = parseAppUrls(config, 'WEB_CLIENT_URL', 'http://localhost:5173');
  const adminUrls = parseAppUrls(config, 'WEB_ADMIN_URL', 'http://localhost:5174');
  const widgetUrls = parseAppUrls(config, 'WIDGET_URL', 'http://localhost:5175');
  const publicSiteUrls = parseAppUrls(config, 'PUBLIC_SITE_URL', 'http://localhost:4321');
  const allowedOrigins = [...clientUrls, ...adminUrls, ...widgetUrls, ...publicSiteUrls];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (originMatchesAppUrls(normalized, allowedOrigins)) {
        return callback(null, true);
      }
      if (isAdminOrigin(normalized, adminUrls)) {
        return callback(null, true);
      }
      // Widget embed/config from customer sites — per-source allowlist in WidgetController/ChatGateway.
      if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  await app.listen(port, config.get<string>('API_HOST', '0.0.0.0'));
  console.log(`API running on http://localhost:${port}/api`);
}

function validateProductionSecrets(config: ConfigService, logger: Logger) {
  if (config.get<string>('NODE_ENV') !== 'production') return;

  const required = [
    'JWT_SECRET',
    'INTEGRATION_ENCRYPTION_KEY',
    'TWO_FA_SECRET_KEY',
    'YOOKASSA_SHOP_ID',
    'YOOKASSA_SECRET_KEY',
    'YOOKASSA_WEBHOOK_SECRET',
  ];

  for (const key of required) {
    const value = config.get<string>(key);
    if (!value || value.includes('change-me') || value.includes('dev-')) {
      throw new Error(`Production requires a secure ${key}`);
    }
  }

  logger.log('Production secrets validated');
}

bootstrap();
