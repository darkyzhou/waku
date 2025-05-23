'use client';

import { useState, useTransition } from 'react';
import { unstable_allowServer as allowServer } from 'waku/client';
import { atom, useAtom } from 'jotai';

export const countAtom = allowServer(atom(1));

export const Counter = () => {
  const [count, setCount] = useState(0);
  const [jotaiCount, setJotaiCount] = useAtom(countAtom);
  const [isPending, startTransition] = useTransition();

  const handleIncrement = () => setCount((c) => c + 1);
  const handleJotaiIncrement = () => {
    startTransition(() => {
      setJotaiCount((c) => c + 1);
    });
  };

  return (
    <section className="border-blue-400 -mx-4 mt-4 rounded-sm border border-dashed p-4">
      <div>Count: {count}</div>
      <button
        onClick={handleIncrement}
        className="rounded-xs bg-black px-2 py-0.5 text-sm text-white"
      >
        Increment
      </button>
      <div>Jotai Count: {jotaiCount}</div>
      <button
        onClick={handleJotaiIncrement}
        className="rounded-xs bg-black px-2 py-0.5 text-sm text-white"
      >
        Jotai Increment{isPending ? '...' : ''}
      </button>
    </section>
  );
};
