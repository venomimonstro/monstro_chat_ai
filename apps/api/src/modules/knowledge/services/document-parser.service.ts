import { Injectable, BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

@Injectable()
export class DocumentParserService {
  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this.parsePdf(buffer);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.parseDocx(buffer);
      case 'text/plain':
      case 'text/csv':
        return buffer.toString('utf-8').trim();
      default:
        throw new BadRequestException(`Неподдерживаемый тип файла: ${mimeType}`);
    }
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text.replace(/\s+/g, ' ').trim();
    } finally {
      await parser.destroy();
    }
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.replace(/\s+/g, ' ').trim();
  }
}
