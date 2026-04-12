import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

interface CardProps extends ViewProps {
  noPadding?: boolean;
}

export const Card = ({ children, noPadding, style, ...props }: CardProps) => {
  return (
    <View style={[styles.card, !noPadding && styles.padding, style]} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  padding: {
    padding: spacing.lg,
  },
});
