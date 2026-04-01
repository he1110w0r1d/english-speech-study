import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { QwenOmniModule } from '../qwen-omni/qwen-omni.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EvaluationService } from '../evaluation/evaluation.service';

@Module({
  imports: [QwenOmniModule, PrismaModule],
  providers: [WsGateway, EvaluationService],
  exports: [WsGateway, EvaluationService],
})
export class WsModule {}
