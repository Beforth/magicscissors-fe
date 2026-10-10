import CategoryManagerModal from './CategoryManagerModal'

// Package categories: kept as a thin wrapper so existing imports keep working.
export default function PackageCategoryModal(props) {
  return <CategoryManagerModal kind="package" {...props} />
}
