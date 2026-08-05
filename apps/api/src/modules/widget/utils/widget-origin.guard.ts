import { ForbiddenException } from '@nestjs/common';
import type { Source } from '@prisma/client';
import type { SourcesService } from '../../sources/sources.service';
import { isWidgetOriginAllowed } from './widget-origin.util';

export function assertWidgetOrigin(
  sourcesService: SourcesService,
  source: Source,
  origin?: string,
  referer?: string,
) {
  if (isWidgetOriginAllowed(sourcesService, source, origin, referer)) return;
  throw new ForbiddenException({
    statusCode: 403,
    code: 'ORIGIN_NOT_ALLOWED',
    message: 'Домен не разрешён для виджета',
  });
}
