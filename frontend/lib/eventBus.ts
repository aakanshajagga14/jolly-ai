import mitt from 'mitt';
import type { EventBus, EventBusEvents } from '@/types';

export function createEventBus(): EventBus {
  return mitt<EventBusEvents>();
}
