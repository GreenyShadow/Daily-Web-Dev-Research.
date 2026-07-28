import { Badge } from '@/components/ui/badge';
import { STATUS_META } from '../lib/constants.js';

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  const variant = meta ? status : 'outline';
  return <Badge variant={variant}>{meta ? meta.label : status || 'Unknown'}</Badge>;
}
