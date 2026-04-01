import { Module } from '@nestjs/common';
import { QwenOmniService } from './qwen-omni.service';

@Module({
  providers: [QwenOmniService],
  exports: [QwenOmniService],
})
export class QwenOmniModule {}
