import { connectDatabase, disconnectDatabase } from '../database/connection';
import { FAQ } from '../database/models/FAQ';
import * as dotenv from 'dotenv';

dotenv.config();

const sampleFAQs = [
  {
    question: 'How do I reset my password?',
    answer: 'To reset your password:\n1. Go to the login page\n2. Click "Forgot Password"\n3. Enter your email\n4. Check inbox for reset link\n5. Set a new password',
    category: 'Account',
    keywords: ['password', 'reset', 'forgot', 'login'],
    order: 1
  },
  {
    question: 'How do I create a support ticket?',
    answer: 'To create a ticket:\n1. Message this bot in private\n2. Use /ticket command\n3. Describe your issue\n4. Wait for team response',
    category: 'Support',
    keywords: ['ticket', 'support', 'help', 'create'],
    order: 2
  },
  {
    question: 'What are your business hours?',
    answer: 'Support hours:\n• Mon-Fri: 9am-6pm EST\n• Sat: 10am-4pm EST\n• Sun: Closed\n\nCreate tickets anytime!',
    category: 'General',
    keywords: ['hours', 'time', 'available', 'open'],
    order: 3
  },
  {
    question: 'How long for a response?',
    answer: 'Response times:\n• Urgent: Within 1 hour\n• Normal: Within 4 hours\n• General: Within 24 hours\n\nDuring business hours only.',
    category: 'Support',
    keywords: ['response', 'time', 'wait', 'how long'],
    order: 4
  },
  {
    question: 'Can I attach files?',
    answer: 'Yes! You can attach:\n• Photos\n• Documents (PDF, DOCX, etc.)\n• Voice messages\n\nJust send them after using /ticket',
    category: 'Support',
    keywords: ['files', 'attach', 'photo', 'document'],
    order: 5
  }
];

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/support_bot';
    await connectDatabase(mongoUri);

    // Optional: Clear existing
    // await FAQ.deleteMany({});

    const results = await FAQ.insertMany(sampleFAQs);
    console.log(`✅ Inserted ${results.length} FAQs:`);
    
    results.forEach(faq => {
      console.log(`   • ${faq.question} (${faq.category})`);
    });

    await disconnectDatabase();
    console.log('✅ Seeding complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seed();