import { SetMetadata } from '@nestjs/common';

export const SKIP_PLATFORM_KEY = 'skipPlatform';
export const SkipPlatform = () => SetMetadata(SKIP_PLATFORM_KEY, true);