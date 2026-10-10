import CategoryManagerModal from './CategoryManagerModal'

// Service categories: kept as a thin wrapper so existing imports keep working.
export default function CategoryModal(props) {
  return <CategoryManagerModal kind="service" {...props} />
}
