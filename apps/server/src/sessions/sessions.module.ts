import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [PrismaModule, WsModule],
  controllers: [SessionsController],
})
export class SessionsModule {}
