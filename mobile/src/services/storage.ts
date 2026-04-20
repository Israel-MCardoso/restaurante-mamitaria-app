import { ImagePickerAsset } from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { ensureOperationalRestaurantContext } from './restaurantContext';

function normalizeContentType(extension: string) {
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return `image/${extension}`;
  }
}

function getFileExtension(asset: ImagePickerAsset) {
  if (asset.fileName?.includes('.')) {
    return asset.fileName.split('.').pop()?.toLowerCase() || 'jpg';
  }

  const uriExtension = asset.uri.split('.').pop()?.toLowerCase();
  if (uriExtension) {
    return uriExtension;
  }

  return 'jpg';
}

function buildSafeFileName(asset: ImagePickerAsset, extension: string) {
  const baseName = asset.fileName?.replace(/\.[^.]+$/, '') || 'upload';
  const safeBaseName = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `${Date.now()}-${safeBaseName || 'file'}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
}

export const storage = {
  async ensureRestaurantId(providedRestaurantId?: string | null) {
    if (providedRestaurantId) {
      return providedRestaurantId;
    }

    const context = await ensureOperationalRestaurantContext();
    return context.restaurantId;
  },
  async uploadImage(
    restaurantId: string | null | undefined,
    folder: string,
    asset: ImagePickerAsset,
    bucket = 'products'
  ) {
    const context = await ensureOperationalRestaurantContext();
    const resolvedRestaurantId = restaurantId || context.restaurantId;
    const extension = getFileExtension(asset);
    const contentType = normalizeContentType(extension);
    const safeFolder = folder === 'products' || folder === 'settings' ? folder : null;

    if (!safeFolder) {
      throw new Error('Pasta de upload invalida. Use apenas "products" ou "settings".');
    }

    if (!resolvedRestaurantId) {
      throw new Error('Restaurante nao encontrado. Nao foi possivel identificar o restaurante para o upload.');
    }

    if (!asset.uri) {
      throw new Error('Arquivo invalido. Nenhum caminho de imagem foi recebido.');
    }

    const fileName = buildSafeFileName(asset, extension);
    const filePath = `${resolvedRestaurantId}/${safeFolder}/${fileName}`;
    console.info('[storage] starting upload', {
      userId: context.userId,
      role: context.role,
      restaurantId: resolvedRestaurantId,
      bucket,
      filePath,
      contentType,
    });

    let fileBody: ArrayBuffer;

    if (asset.base64) {
      fileBody = decode(asset.base64);
    } else {
      const response = await fetch(asset.uri);
      fileBody = await response.arrayBuffer();
    }

    const { error } = await supabase.storage.from(bucket).upload(filePath, fileBody, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.error('[storage] upload failed', {
        restaurantId: resolvedRestaurantId,
        bucket,
        filePath,
        message: error.message,
      });
      throw new Error(error.message || 'Nao foi possivel enviar a imagem para o storage.');
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

    if (!data?.publicUrl) {
      console.error('[storage] public url generation failed', {
        restaurantId: resolvedRestaurantId,
        bucket,
        filePath,
      });
      throw new Error('Upload concluido, mas a URL publica da imagem nao foi gerada.');
    }

    console.info('[storage] upload succeeded', {
      restaurantId: resolvedRestaurantId,
      bucket,
      filePath,
      publicUrl: data.publicUrl,
    });

    return data.publicUrl;
  },
  async removeImageByPublicUrl(publicUrl: string | null | undefined, bucket = 'products') {
    if (!publicUrl) {
      return;
    }

    let filePath: string | null = null;

    try {
      const url = new URL(publicUrl);
      const marker = `/storage/v1/object/public/${bucket}/`;
      const markerIndex = url.pathname.indexOf(marker);

      if (markerIndex === -1) {
        console.warn('[storage] skipping image removal because url does not match bucket', {
          bucket,
          publicUrl,
        });
        return;
      }

      filePath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
    } catch (error: any) {
      console.warn('[storage] failed to parse public url for removal', {
        bucket,
        publicUrl,
        message: error?.message ?? 'unknown error',
      });
      return;
    }

    if (!filePath) {
      return;
    }

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      console.warn('[storage] failed to remove image from storage', {
        bucket,
        filePath,
        message: error.message,
      });
      return;
    }

    console.info('[storage] removed image from storage', {
      bucket,
      filePath,
    });
  },
};
