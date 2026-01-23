import { useState, useEffect } from 'react';
import { apiClient, Category } from '../api/client'; // Import the type and client

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (categories: string[]) => void;
  isSending: boolean;
}

export function CategoryModal({ isOpen, onClose, onConfirm, isSending }: CategoryModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  
  // 1. Replace hardcoded constant with State
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // 2. Fetch categories when the modal opens
  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  async function loadCategories() {
    try {
      setLoading(true);
      const data = await apiClient.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const toggleCategory = (id: string) => {
    setSelected(prev => 
      prev.includes(id) 
        ? prev.filter(c => c !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-700">Categorize & Close</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            &times;
          </button>
        </div>

        {/* List Area */}
        <div className="p-4 overflow-y-auto">
          <p className="text-sm text-gray-500 mb-4 text-center">
            Select all categories that apply to this ticket.
          </p>
          
          {loading ? (
            <div className="text-center py-8 text-gray-400 animate-pulse">Loading categories...</div>
          ) : (
            <div className="flex flex-col gap-2">
              {categories.length === 0 ? (
                <div className="text-center text-gray-400 py-4">No categories configured.</div>
              ) : (
                categories.map((cat) => {
                  const isSelected = selected.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`
                        p-3 rounded-lg text-left transition-all duration-200 border
                        flex items-start gap-3
                        ${isSelected 
                          ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                          : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'}
                      `}
                    >
                      <div className={`
                        w-5 h-5 mt-0.5 rounded border flex items-center justify-center flex-none
                        ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'}
                      `}>
                        {isSelected && <span className="text-xs">✓</span>}
                      </div>
                      
                      <div>
                        <div className="font-medium text-gray-800 text-sm">{cat.label}</div>
                        {cat.description && (
                          <div className="text-xs text-gray-500 mt-0.5 leading-tight">
                            {cat.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSending}
            className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={isSending || selected.length === 0}
            className={`
              flex-1 py-2 px-4 rounded-lg font-bold text-white shadow flex justify-center items-center
              ${selected.length === 0 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-red-600 hover:bg-red-700'}
              disabled:opacity-70
            `}
          >
            {isSending ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Close Ticket'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}