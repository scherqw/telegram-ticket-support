import { FAQ, IFAQ } from '../../database/models/FAQ';

/**
 * Searches FAQs by keyword
 */
export async function searchFAQs(query: string): Promise<IFAQ[]> {
  const searchTerms = query.toLowerCase().split(' ');
  
  const faqs = await FAQ.find({
    isActive: true,
    $or: [
      { keywords: { $in: searchTerms } },
      { question: { $regex: query, $options: 'i' } },
      { answer: { $regex: query, $options: 'i' } }
    ]
  }).limit(10);

  return faqs;
}