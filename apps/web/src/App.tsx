import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Loader } from "@/components/shared/Loader";
import { PageBackground } from "@/components/shared/PageBackground";
import VotePage from "@/pages/VotePage";
import DisplayPage from "@/pages/DisplayPage";
import AdminPage from "@/pages/admin/AdminPage";
import ColorSelectionRoute from "@/pages/color-selection/ColorSelectionRoute";

// Code-split: pulls in the QR-scanning library, only needed by judges.
const JudgeRoute = lazy(() => import("@/pages/judge/JudgeRoute"));

export default function App() {
  return (
    <>
      <Toaster position="top-center" richColors closeButton />
      <Routes>
        <Route path="/" element={<Navigate to="/vote" replace />} />
        <Route path="/vote" element={<VotePage />} />
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/select-color/:token" element={<ColorSelectionRoute />} />
        <Route
          path="/judge"
          element={
            <Suspense
              fallback={
                <PageBackground>
                  <Loader label="Loading judge panel..." />
                </PageBackground>
              }
            >
              <JudgeRoute />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/vote" replace />} />
      </Routes>
    </>
  );
}
