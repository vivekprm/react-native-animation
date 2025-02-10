import React from "react";
import { Text as RNText } from "react-native";

import { StyleGuide } from "./StyleGuide";

export const Text = ({ dark, type, style, children }) => {
  const color = dark ? "white" : "black";
  return (
    <RNText style={[StyleGuide.typography[type || "body"], { color }, style]}>
      {children}
    </RNText>
  );
};
