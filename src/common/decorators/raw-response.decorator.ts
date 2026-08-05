import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_WRAP_KEY = 'skipResponseWrap';

export const RawResponse = () => SetMetadata(SKIP_RESPONSE_WRAP_KEY, true);
