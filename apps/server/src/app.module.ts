import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { QwenOmniModule } from './qwen-omni/qwen-omni.module';
import { WsModule } from './ws/ws.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    PrismaModule,
    QwenOmniModule,
    WsModule,
    SessionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
