/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  experimental: {
    serverActions: {
      // A importação de MDF-e manda os XML no corpo da action. O limite padrão
      // é 1 MB, e um mês de manifestos passa disso — são 70 a 90 fretes.
      bodySizeLimit: '8mb',
    },
  },
}

export default nextConfig
