import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, NestInterceptor, ExecutionContext, CallHandler, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppModule } from './app.module';
import helmet from 'helmet'; // <- cambio aquí
import { ConfigService } from '@nestjs/config';
import { resolveUploadsRoot } from './shared/utils/uploads-root';

@Injectable()
class LogoUrlInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');

    const isPlainObject = (v: any) => v && typeof v === 'object' && v.constructor === Object;

    const normalize = (data: any): any => {
      // No tocar valores primitivos ni Date
      if (!data || typeof data !== 'object') return data;
      if (data instanceof Date) return data.toISOString();
      if (Array.isArray(data)) return data.map(normalize);

      // Solo recorrer objetos llanos (plain objects) para evitar romper clases/instancias
      if (!isPlainObject(data)) return data;

      const out: any = {};
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (key === 'logo' && typeof val === 'string' && val.startsWith('/uploads')) {
          out[key] = `${protocol}://${host}${val}`;
        } else if (isPlainObject(val) || Array.isArray(val)) {
          out[key] = normalize(val);
        } else if (val instanceof Date) {
          out[key] = val.toISOString();
        } else {
          out[key] = val;
        }
      }
      return out;
    };

    return next.handle().pipe(map(data => normalize(data)));
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Confiar en el proxy para detectar HTTPS correctamente (Railway)
  app.set('trust proxy', 1);
  const configService = app.get(ConfigService);
  // Seguridad
  // Aplicamos helmet y permitimos carga cross-origin de recursos estáticos
  app.use(helmet());
  try {
    app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
  } catch (e) {
    // En algunas versiones de helmet la función puede no existir; ignoramos si falla
    console.warn('crossOriginResourcePolicy no disponible en helmet:', e);
  }

  const frontendUrl = configService.get('FRONTEND_URL') || 'https://oasis-guest-house-stock.vercel.app';

  app.enableCors({
    origin: [frontendUrl, 'http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Authorization', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  // Validación global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Prefijo global
  app.setGlobalPrefix('api');

  // Asegurar que recursos servidos desde /uploads permitan ser cargados desde otros orígenes
  app.use('/uploads', (req, res, next) => {
    // Permitir uso cross-origin de recursos estáticos (para <img>, <link>, etc.)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // También permitir CORS en caso de que el navegador lo requiera para ciertas solicitudes
    const origin = req.headers.origin as string | undefined;
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });

  // Servir carpeta uploads como estática en /uploads
  // Esto expone backend/uploads/* en http://HOST:PORT/uploads/*
  const uploadsRoot = resolveUploadsRoot(configService.get('UPLOAD_PATH', './uploads'));
  app.useStaticAssets(uploadsRoot, { prefix: '/uploads' });

  // Interceptor global: convierte rutas de 'logo' que empiezan con '/uploads' en URLs absolutas
  app.useGlobalInterceptors(new LogoUrlInterceptor());

  const port = configService.get('PORT', 3000);
  await app.listen(port);
  console.log(`🚀 Aplicación corriendo en: http://localhost:${port}`);
}
bootstrap();
