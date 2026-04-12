import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type StatusVariant = 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

interface BadgeProps {
  status: StatusVariant;
}

const statusMap: Record<StatusVariant, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: colors.status.pending },
  confirmed: { label: 'Confirmado', color: colors.status.confirmed },
  preparing: { label: 'Preparando', color: colors.status.preparing },
  shipped: { label: 'Em Entrega', color: colors.status.shipped },
  delivered: { label: 'Entregue', color: colors.status.delivered },
  cancelled: { label: 'Cancelado', color: colors.status.cancelled },
};

export const Badge = ({ status }: BadgeProps) => {
  const info = statusMap[status] || { label: status, color: colors.textSecondary };

  return (
    <View style={[styles.badge, { backgroundColor: info.color + '15', borderColor: info.color }]}>
      <View style={[styles.dot, { backgroundColor: info.color }]} />
      <Text style={[styles.text, { color: info.color }]}>{info.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  text: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
});
