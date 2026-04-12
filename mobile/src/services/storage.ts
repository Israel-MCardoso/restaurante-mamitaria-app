import { ImagePickerAsset } from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

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

export const storage = {
  async uploadImage(
    restaurantId: string,
    folder: string,
    asset: ImagePickerAsset,
    bucket = 'products'
  ) {
    const extension = getFileExtension(asset);
    const contentType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
    const filePath = `${restaurantId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

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
      throw error;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  },
};
