import React, { useState } from 'react';
import { updateTab } from '../services/tabService';

const EditTab = ({ tab, onUpdate }) => {
  const [amount, setAmount] = useState(tab.amount);
  const [description, setDescription] = useState(tab.description);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const updatedData = {
        amount,
        description,
        lastUpdated: new Date()
      };
      
      await updateTab(tab.id, updatedData);
      if (onUpdate) {
        onUpdate(updatedData);
      }
    } catch (error) {
      console.error('Failed to update tab:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="amount">Amount:</label>
        <input
          type="number"
          id="amount"
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
          required
        />
      </div>
      <div>
        <label htmlFor="description">Description:</label>
        <input
          type="text"
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Updating...' : 'Update Tab'}
      </button>
    </form>
  );
};

export default EditTab; 