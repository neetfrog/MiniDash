'use client';

import { useState, useEffect } from 'react';
import { CheckSquare } from 'lucide-react';
import TerminalBox from '@/components/ui/TerminalBox';
import styles from './TodoWidget.module.css';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

const STORAGE_KEY = 'minimalstuff-todos';

export default function TodoWidget() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setTodos(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse todos from localStorage', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (inputValue.trim()) {
      const newTodo: Todo = {
        id: Date.now().toString(),
        text: inputValue.trim(),
        completed: false,
      };
      setTodos(prev => [...prev, newTodo]);
      setInputValue('');
    }
  };

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTodo();
  };

  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;

  return (
    <TerminalBox
      title="todo --list"
      icon={<CheckSquare size={14} />}
      status={`${completedCount}/${totalCount} completed`}
    >
      <div className={styles.container}>
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <span className={styles.prompt}>$</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Add a new task..."
            className={styles.input}
          />
          <button type="submit" onClick={addTodo} className={styles.button}>[add]</button>
        </form>

        <div className={styles.list}>
          {todos.map((todo) => (
            <div key={todo.id} className={`${styles.task} ${todo.completed ? styles.completed : ''}`}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className={styles.checkbox}
              />
              <span className={styles.taskText}>{todo.text}</span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className={styles.deleteBtn}
              >
                [x]
              </button>
            </div>
          ))}
        </div>
      </div>
    </TerminalBox>
  );
}