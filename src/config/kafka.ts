import { Kafka, Producer, Consumer } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'nigerian-banking-api',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

let producer: Producer | null = null;

export async function connectProducer(): Promise<void> {
  producer = kafka.producer();
  await producer.connect();
  console.log('Kafka producer connected');
}

export async function publishTransactionEvent(data: {
  transactionId: string;
  accountId: string;
  accountNumber: string;
  accountName: string;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  description: string;
}): Promise<void> {
  if (!producer) {
    console.warn('Kafka producer not connected — skipping event publish');
    return;
  }

  const event = {
    eventType: 'TRANSACTION_COMPLETED',
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    await producer.send({
      topic: 'transaction.completed',
      messages: [
        {
          key: data.accountId,
          value: JSON.stringify(event),
        },
      ],
    });
    console.log(`Kafka event published: TRANSACTION_COMPLETED for account ${data.accountNumber}`);
  } catch (err) {
    console.error('Failed to publish Kafka event:', err);
  }
}

export function createConsumer(groupId: string): Consumer {
  return kafka.consumer({ groupId });
}

export default kafka;