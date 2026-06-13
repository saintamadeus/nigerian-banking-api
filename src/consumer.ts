import dotenv from 'dotenv';
dotenv.config();

import { createConsumer } from './config/kafka';

const consumer = createConsumer('transaction-notification-group');

async function startConsumer(): Promise<void> {
  await consumer.connect();
  console.log('Kafka consumer connected');

  await consumer.subscribe({
    topic: 'transaction.completed',
    fromBeginning: true,
  });

  console.log('Subscribed to topic: transaction.completed');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const raw = message.value?.toString();
      if (!raw) return;

      try {
        const event = JSON.parse(raw);
        console.log('--- TRANSACTION EVENT RECEIVED ---');
        console.log(`Event Type : ${event.eventType}`);
        console.log(`Timestamp  : ${event.timestamp}`);
        console.log(`Account    : ${event.data.accountName} (${event.data.accountNumber})`);
        console.log(`Type       : ${event.data.type.toUpperCase()}`);
        console.log(`Amount     : ₦${parseFloat(event.data.amount).toLocaleString()}`);
        console.log(`Balance    : ₦${parseFloat(event.data.balanceBefore).toLocaleString()} → ₦${parseFloat(event.data.balanceAfter).toLocaleString()}`);
        console.log(`Description: ${event.data.description}`);
        console.log('----------------------------------');
      } catch (err) {
        console.error('Failed to process Kafka message:', err);
      }
    },
  });
}

startConsumer().catch((err) => {
  console.error('Consumer failed to start:', err);
  process.exit(-1);
});