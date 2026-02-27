import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
