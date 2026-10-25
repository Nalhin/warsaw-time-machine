import { llmsIndex, textResponse } from '@/lib/llms';

export const dynamic = 'force-static';

export function GET() {
  return textResponse(llmsIndex());
}
