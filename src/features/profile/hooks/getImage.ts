import ImagePicker from "react-native-image-crop-picker";
import RNFS from "react-native-fs";
import { Platform } from "react-native";

export const getImage = async () => {
  try {
    const image = await ImagePicker.openPicker({
      width: 400,
      height: 400,
      cropping: true,
      freeStyleCropEnabled: true,
      mediaType: 'photo',
      includeBase64: false,
    });

    if (!image.path) {
      return;
    }

    const sourcePath = image.path;

    // Create a permanent path in the app's private storage
    const dirPath = `${RNFS.DocumentDirectoryPath}/qr_images`;
    // Extract filename from path or generate one
    const fileName = `qr_cropped_${Date.now()}.jpg`;
    const destPath = `${dirPath}/${fileName}`;

    // Ensure directory exists
    const dirExists = await RNFS.exists(dirPath);
    if (!dirExists) {
      await RNFS.mkdir(dirPath);
    }

    // Copy the cropped image to private storage
    // Note: image-crop-picker creates a temp file, so we move it to our permanent folder
    await RNFS.copyFile(sourcePath, destPath);

    // Cleanup the temp file created by the picker
    try {
        await ImagePicker.cleanSingle(sourcePath);
    } catch (e) {
        console.warn("Could not clean temp image:", e);
    }

    console.log("Cropped image saved to:", destPath);

    return Platform.OS === 'ios' ? destPath : `file://${destPath}`;
  } catch (error: any) {
    if (error.message?.includes('User cancelled')) {
      return;
    }
    console.error("Error picking/cropping image:", error);
    return;
  }
};
