import React, { useState, useEffect } from 'react';
import { Text, TextStyle } from 'react-native';

interface ShuffleTextProps {
  text: string;
  style?: TextStyle | TextStyle[];
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';

export const ShuffleText: React.FC<ShuffleTextProps> = ({ text, style }) => {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText((prev) =>
        text
          .split('')
          .map((letter, index) => {
            if (index < iteration) {
              return text[index];
            }
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join('')
      );

      if (iteration >= text.length) {
        clearInterval(interval);
      }
      iteration += 1 / 3; // Tốc độ chạy chữ (càng nhỏ càng chạy lâu)
    }, 40); // Tốc độ lặp

    return () => clearInterval(interval);
  }, [text]);

  return <Text style={style}>{displayText}</Text>;
};